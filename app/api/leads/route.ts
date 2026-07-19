import { prisma } from "@/lib/db";
import { unauthorized } from "@/lib/api-auth";
import { underLimit, recordHit } from "@/lib/rate-limit";
import { bookCallEvent } from "@/lib/gcal";
import { sendEmail } from "@/lib/email";
import { isWithinWeekendWindow, buildWeekendAutoReply } from "@/lib/weekend-autoreply";
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

/** Tilbudsmotorens payload: valgte services + estimat + kundetype (+ evt.
 *  valideret rabatkode). Alt er valgfrit og valideres felt for felt —
 *  ukendte/ugyldige rækker droppes. */
type TmService = { id: string; navn: string; wm: string | null; qty: number; enhed: string; freq: number; pris: number | null };
type Rabat = { rabatkode: string; rabatOk: boolean; rabatPct: number | null };
function parseTmPayload(body: Record<string, unknown>, rabat: Rabat | null): { payloadJson: string | null; kundetype: string | null; services: TmService[]; estimatMd: number } {
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
    }];
  });

  const e = body.estimat && typeof body.estimat === "object" ? (body.estimat as Record<string, unknown>) : {};
  const estimat = { md: num(e.md, 10_000_000), aar: num(e.aar, 100_000_000), visits: num(e.visits, 366), count: num(e.count, 100) };

  const payloadJson = kundetype || services.length || rabat
    ? JSON.stringify({ kundetype, services, estimat, ...(rabat ?? {}) })
    : null;
  return { payloadJson, kundetype, services, estimatMd: estimat.md };
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

  // Rabatkode (valgfri): valideres mod DiscountCode med samme where-logik som
  // /api/discount-codes/validate — startOfToday i UTC, fordi expiresAt gemmes
  // som T00:00:00Z (så en kode der udløber "i dag" stadig er gyldig). Opslaget
  // må ALDRIG vælte lead-oprettelsen: fejl → koden behandles som ugyldig.
  const rabatkode = str(body.rabatkode, 40).toUpperCase();
  let rabat: Rabat | null = null;
  if (rabatkode) {
    let hit: { percent: number } | null = null;
    try {
      const startOfToday = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      hit = await prisma.discountCode.findFirst({
        where: {
          code: { equals: rabatkode, mode: "insensitive" },
          OR: [{ expiresAt: null }, { expiresAt: { gte: startOfToday } }],
        },
      });
    } catch (e) {
      console.error("[leads] rabatkode-opslag fejlede — behandles som ugyldig:", e);
    }
    rabat = { rabatkode, rabatOk: !!hit, rabatPct: hit ? hit.percent : null };
  }

  const tm = parseTmPayload(body, rabat);

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
    // Ingen ny kalender-booking ved dedup — det åbne lead har allerede sit opkalds-slot.
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
      tm.estimatMd ? `Estimat: ${DKK.format(tm.estimatMd)} kr/md` : null,
      rabat ? `Rabatkode: ${rabat.rabatkode}${rabat.rabatOk ? ` (−${rabat.rabatPct}%)` : " (ugyldig)"}` : null,
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

  // Godkendt weekend-autosvar: kun for HELT NYE leads (aldrig ved dedup-merge
  // ovenfor, som returnerer tidligt), kun hvis leadet har en e-mail, og kun
  // inden for weekend-vinduet (fre 16:00 → man 08:00, Europe/Copenhagen). Må
  // ALDRIG vælte eller forsinke lead-oprettelsen: alt i try/catch, fejl logges
  // og rapporteres i svaret. Sendes AS firmaet (EMAIL_FROM), ikke en handyman.
  let autoReply: "sent" | "skipped" | "outside-window" | "no-email" | "failed" = "skipped";
  try {
    if (!email) {
      autoReply = "no-email";
    } else if (!isWithinWeekendWindow(new Date())) {
      autoReply = "outside-window";
    } else {
      const { subject, text } = buildWeekendAutoReply(name);
      const sent = await sendEmail({ to: email, subject, text });
      autoReply = sent.ok ? "sent" : "failed";
      if (!sent.ok) console.error(`[leads] weekend-autosvar fejlede for lead ${lead.id}: ${sent.error}`);
    }
  } catch (e) {
    autoReply = "failed";
    console.error(`[leads] weekend-autosvar exception for lead ${lead.id}:`, e);
  }

  return json({ id: lead.id, deduplicated: false, call, autoReply }, 201);
}
