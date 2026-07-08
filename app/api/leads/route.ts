import { prisma } from "@/lib/db";
import { unauthorized } from "@/lib/api-auth";
import { underLimit, recordHit } from "@/lib/rate-limit";
import { bookCallEvent } from "@/lib/gcal";
import { tryLogEvent } from "@/lib/timeline";
import { renderLeadConfirmation } from "@/lib/lead-confirmation";
import { sendEmail } from "@/lib/email";
import { after } from "next/server";
import type { NextRequest } from "next/server";

// Inbound lead webhook for the public website form. No session cookie —
// middleware exempts /api — so it authenticates with a shared-secret header
// (LEAD_WEBHOOK_SECRET), compared in constant time (hash both sides, XOR the
// fixed-length digests, same idiom as lib/session.ts). Fails CLOSED: with no
// secret configured the endpoint is 503, never silently open.
//
// The caller must be the website's SERVER (a form relay), never the browser —
// a browser POST would expose the secret in devtools. No CORS headers are
// emitted, which also keeps browsers out.

const enc = new TextEncoder();

async function secretOk(given: string | null): Promise<boolean | "unconfigured"> {
  const secret = process.env.LEAD_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) return "unconfigured";
  if (!given) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(secret)),
  ]);
  const ua = new Uint8Array(a), ub = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const normEmail = (e: string) => e.toLowerCase();
const normPhone = (p: string) => p.replace(/[^\d]/g, "").replace(/^(45|0045)(?=\d{8}$)/, "");
const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);

/** Tilbudsmotorens payload: valgte services + estimat + kundetype. Alt er
 *  valgfrit og valideres felt for felt — ukendte/ugyldige rækker droppes. */
type TmService = { id: string; navn: string; wm: string | null; qty: number; enhed: string; freq: number; pris: number | null; pakke: boolean };
type TmEstimat = { md: number; aar: number; visits: number; count: number };
function parseTmPayload(body: Record<string, unknown>): { payloadJson: string | null; kundetype: string | null; services: TmService[]; estimat: TmEstimat } {
  const kt = str(body.kundetype, 10).toLowerCase();
  const kundetype = kt === "privat" || kt === "erhverv" ? kt : null;

  const services: TmService[] = (Array.isArray(body.services) ? body.services.slice(0, 40) : []).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const s = row as Record<string, unknown>;
    const navn = str(s.navn, 120);
    if (!navn) return [];
    return [{
      id: str(s.id, 40) || "ukendt",
      navn,
      wm: str(s.wm, 120) || null,           // WorkMaker-produktnavn (join-nøgle under overgangen)
      qty: num(s.qty, 100_000),
      enhed: str(s.enhed, 40),
      freq: num(s.freq, 366),
      pris: typeof s.pris === "number" && Number.isFinite(s.pris) && s.pris >= 0 ? Math.min(s.pris, 1_000_000) : null,
      pakke: s.pakke === true,              // del af Villapakken → "indeholdt" i bekræftelsesmailen
    }];
  });

  const e = body.estimat && typeof body.estimat === "object" ? (body.estimat as Record<string, unknown>) : {};
  const estimat = { md: num(e.md, 10_000_000), aar: num(e.aar, 100_000_000), visits: num(e.visits, 366), count: num(e.count, 100) };

  const payloadJson = kundetype || services.length
    ? JSON.stringify({ kundetype, services, estimat })
    : null;
  return { payloadJson, kundetype, services, estimat };
}

const DKK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  // Auth — failed secret checks are rate-limited (like login in app/actions/auth.ts).
  if (!underLimit(`leads:auth:${ip}`, 20)) return json({ error: "Too many requests" }, 429);
  const ok = await secretOk(req.headers.get("x-karltoffel-secret"));
  if (ok === "unconfigured") return json({ error: "Lead intake not configured" }, 503);
  if (!ok) { recordHit(`leads:auth:${ip}`, 60_000); return unauthorized(); }

  // Flood cap on accepted submissions.
  if (!underLimit(`leads:create:${ip}`, 10)) return json({ error: "Too many requests" }, 429);

  if (Number(req.headers.get("content-length") ?? 0) > 10_240) return json({ error: "Payload too large" }, 400);
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: "Invalid JSON" }, 400); }

  const name = str(body.name, 200);
  const emailRaw = str(body.email, 320);
  const phoneRaw = str(body.phone, 32);
  const email = emailRaw ? normEmail(emailRaw) : null;
  const phone = phoneRaw ? normPhone(phoneRaw) : null;
  if (!name) return json({ error: "name is required" }, 400);
  if (!email && !phone) return json({ error: "email or phone is required" }, 400);
  if (email && !/.+@.+\..+/.test(email)) return json({ error: "invalid email" }, 400);

  const utmIn = body.utm && typeof body.utm === "object" ? (body.utm as Record<string, unknown>) : null;
  const utm = utmIn
    ? JSON.stringify(Object.fromEntries(
        ["source", "medium", "campaign", "term", "content"].flatMap((k) => {
          const v = str(utmIn[k], 100);
          return v ? [[k, v]] : [];
        }),
      ))
    : null;

  const company = await prisma.company.findFirst(); // single-tenant, same as app/actions/contacts.ts
  if (!company) return json({ error: "No company configured" }, 503);

  recordHit(`leads:create:${ip}`, 60_000);

  const message = str(body.message, 2000) || null;
  const address = str(body.address, 300) || null;
  const tm = parseTmPayload(body);

  // Dedup: merge into an OPEN lead (<=30 days) with the same normalised email/phone.
  const since = new Date(Date.now() - 30 * 86_400_000);
  const dupOr: object[] = [];
  if (email) dupOr.push({ email });
  if (phone) dupOr.push({ phone });
  const existing = await prisma.lead.findFirst({
    where: { companyId: company.id, status: { in: ["new", "contacted"] }, createdAt: { gte: since }, OR: dupOr },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        message: message ? [existing.message, message].filter(Boolean).join("\n---\n") : existing.message,
        email: existing.email ?? email,
        phone: existing.phone ?? phone,
        address: existing.address ?? address,
        payload: tm.payloadJson ?? existing.payload,   // nyeste pakkevalg vinder
      },
    });
    // Tidslinje: gen-henvendelse på et åbent emne, så kunderejsen ikke taber
    // den. Ingen ny kalender-booking eller mail ved dedup (slot/kvittering findes
    // allerede — undgår dobbelt-opkald og dobbelt-mail).
    await tryLogEvent(prisma, {
      companyId: company.id, leadId: existing.id, contactId: existing.contactId, type: "lead_updated",
      title: "Ny henvendelse via tilbudsmotoren",
      body: tm.services.length
        ? `Opdateret valg: ${tm.services.map((s) => s.navn).slice(0, 20).join(", ")}`
        : "Kunden sendte formularen igen (ingen ydelser valgt).",
    });
    return json({ id: existing.id, deduplicated: true }, 200);
  }

  // Pre-link an existing customer so the UI can badge "eksisterende kunde".
  const known = await prisma.contact.findFirst({
    where: { companyId: company.id, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
    select: { id: true },
  });

  const lead = await prisma.lead.create({
    data: {
      companyId: company.id, name, email, phone, address, message,
      source: str(body.source, 50) || "website", utm, ip,
      payload: tm.payloadJson,
      contactId: known?.id ?? null,
    },
  });

  // Tidslinje: første skridt i kunderejsen — "takkede ja tak til at blive
  // kontaktet" + de valgte ydelser. Best-effort (må aldrig vælte lead-svaret).
  const svcLinjer = tm.services.slice(0, 20).map((s) =>
    `• ${s.navn}${s.qty ? ` — ${DKK.format(s.qty)} ${s.enhed}` : ""}${s.freq ? ` × ${s.freq}/år` : ""}`);
  if (tm.services.length > 20) svcLinjer.push(`… og ${tm.services.length - 20} mere`);
  const ktLabel = tm.kundetype === "erhverv" ? "Erhverv" : tm.kundetype === "privat" ? "Privat" : null;
  await tryLogEvent(prisma, {
    companyId: company.id, leadId: lead.id, contactId: known?.id ?? null, type: "lead_created",
    title: "Kunde takkede ja tak til at blive kontaktet",
    body: [
      ktLabel ? `Kundetype: ${ktLabel}` : null,
      tm.services.length ? "Ønskede ydelser:" : "Ingen ydelser valgt endnu.",
      ...svcLinjer,
      tm.estimat.md ? `Estimat: ~${DKK.format(tm.estimat.md)} kr/md` : null,
    ].filter(Boolean).join("\n"),
  });

  // Book 15-min opkalds-slot i den fælles kalender — hurtigst muligt (lead
  // 15:00 → slot 15:15). Må ALDRIG vælte lead-oprettelsen: fejl logges og
  // rapporteres i svaret, men leadet er allerede gemt.
  let call: string = "skipped";
  try {
    const lines = tm.services.slice(0, 12).map((s) =>
      `• ${s.navn}${s.qty ? ` — ${DKK.format(s.qty)} ${s.enhed}` : ""}${s.freq ? ` × ${s.freq}/år` : ""}`);
    if (tm.services.length > 12) lines.push(`… og ${tm.services.length - 12} mere`);
    const desc = [
      `Nyt lead fra tilbudsmotoren — ring op, bekræft prisen og konvertér.`,
      ``,
      `Navn: ${name}`,
      phone ? `Telefon: ${phone}` : null,
      email ? `E-mail: ${email}` : null,
      address ? `Adresse: ${address}` : null,
      tm.kundetype ? `Kundetype: ${tm.kundetype === "erhverv" ? "Erhverv" : "Privat"}` : null,
      tm.estimat.md ? `Estimat: ${DKK.format(tm.estimat.md)} kr/md` : null,
      lines.length ? `` : null,
      ...lines,
      ``,
      `CRM: https://karltoffel-crm.vercel.app/leads`,
    ].filter((l): l is string => l !== null).join("\n");
    const booked = await bookCallEvent({ summary: `☎️ Ring til ${name} (nyt lead #${lead.id})`, description: desc });
    call = booked.simulated ? "simulated" : booked.ok ? `booked ${booked.slot.start}` : `failed: ${booked.error}`;
    if (!booked.ok) console.error(`[leads] kalender-booking fejlede for lead ${lead.id}: ${booked.error}`);
  } catch (e) {
    call = "failed";
    console.error(`[leads] kalender-booking exception for lead ${lead.id}:`, e);
  }

  // Tidslinje: opkalds-slottet (hvis det blev lagt i kalenderen).
  const slot = /^booked (\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(call);
  if (slot) {
    await tryLogEvent(prisma, {
      companyId: company.id, leadId: lead.id, contactId: known?.id ?? null, type: "call_booked",
      title: "Opkald booket i kalenderen", body: `Ring-slot: ${slot[1]} kl. ${slot[2]}`,
    });
  }

  // Bekræftelsesmail til kunden + tidslinje-hændelse med NØJAGTIGT indhold, så
  // en medarbejder kan se præcis hvad kunden modtog. Best-effort: sender kun
  // hvis kunden har oplyst e-mail. Kører via after() EFTER svaret er sendt, så
  // Resend-kaldet (op til 8s) ikke ligger på webhookens svar-kritiske vej.
  if (email) {
    const mailCall = slot ? `booked ${slot[1]}T${slot[2]}:00` : null;
    after(async () => {
      try {
        const mail = renderLeadConfirmation({
          name, address, kundetype: tm.kundetype, services: tm.services,
          estimat: { aar: tm.estimat.aar, visits: tm.estimat.visits }, call: mailCall,
        });
        const res = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
        if (res.ok) {
          await tryLogEvent(prisma, {
            companyId: company.id, leadId: lead.id, contactId: known?.id ?? null, type: "email_sent",
            title: "Bekræftelsesmail på tilbud sendt",
            body: res.simulated ? "Simuleret (ingen mail-nøgle sat — mailen blev IKKE sendt)." : `Sendt til ${email}`,
            meta: { to: email, subject: mail.subject, text: mail.text, html: mail.html, simulated: !!res.simulated, resendId: res.id ?? null },
          });
        } else {
          console.error(`[leads] bekræftelsesmail fejlede for lead ${lead.id}: ${res.error}`);
        }
      } catch (e) {
        console.error(`[leads] bekræftelsesmail exception for lead ${lead.id}:`, e);
      }
    });
  }

  return json({ id: lead.id, deduplicated: false, call }, 201);
}
