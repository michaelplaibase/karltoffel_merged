import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { requireSession, unauthorized } from "@/lib/api-auth";

// "Vi kommer i morgen"-påmindelse. Kører én gang dagligt (se vercel.json,
// 06:00 UTC — Vercel Hobby-planen tillader kun ét dagligt kald pr. cron,
// derfor ikke et 30-min-interval med rullende 24-timers-vindue). Finder alle
// ordrer der er booket til NÆSTE kalenderdag (Europe/Copenhagen) og sender én
// påmindelse hver morgen, samme princip som de fleste håndværker-CRM'er bruger
// ("vi kommer i morgen") frem for et minut-nøjagtigt 24-timers-tjek.
//
// Vinduet dækker OGSÅ resten af "i dag" (med mailtekst "vi kommer i dag"): det
// er retry-nettet for en afsendelse der fejlede i går (rollbacken nedenfor) —
// ordren er ved næste kørsel dags dato og ville ellers falde permanent ud af et
// rent "i morgen"-vindue, så kunden aldrig fik sin påmindelse. Vinduerne er
// hele danske kalenderdøgn (00:00 → 00:00 Europe/Copenhagen, DST-sikkert) —
// IKKE "+36 timer", som fangede overmorgen-ordrer en dag for tidligt og satte
// reminderSentAt, så den rigtige påmindelse blev undertrykt.
//
// Idempotens: Order.reminderSentAt sættes FØR afsendelsen (samme mønster som
// tilbudsmailens tilbudSendtAt-værn), så en fejlslagen/gentaget cron-kørsel
// aldrig sender to påmindelser for samme ordre.
//
// MIDLERTIDIGT STOPPET (2026-08-10, Michael): "vi kommer i morgen"-mailen skal
// IKKE sendes automatisk lige nu — I skriver manuelt til kunderne, indtil
// systemet er helt på plads. Cron-triggeret i vercel.json er fjernet, og denne
// route er derudover spærret bag REMINDER_EMAILS_ENABLED som en ekstra
// sikkerhed mod utilsigtet automatisk afsendelse (fx et manuelt cron-hit).
// Sæt REMINDER_EMAILS_ENABLED=true og genindsæt cron-linjen i vercel.json for
// at genaktivere.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TZ = "Europe/Copenhagen";

/** Dansk vægur for et UTC-tidspunkt, som UTC-ms af (år, md, dag, time, min). */
function cphWallUtcMs(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? "0");
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
}

/** UTC-tidspunktet for midnat (00:00 dansk tid) `addDays` dage efter `now`s
 *  danske kalenderdato. DST-sikker: startgættet ("som om DK var UTC")
 *  korrigeres iterativt mod det faktiske danske vægur i stedet for at antage
 *  et fast offset eller lægge hele døgn-multipla af timer til. */
function cphMidnightUtc(now: Date, addDays: number): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? "0");
  const targetWall = Date.UTC(get("year"), get("month") - 1, get("day") + addDays);
  let ts = targetWall;
  for (let i = 0; i < 2; i++) ts += targetWall - cphWallUtcMs(new Date(ts));
  return new Date(ts);
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  if (!isCron && (await requireSession()) == null) return unauthorized();

  if (process.env.REMINDER_EMAILS_ENABLED !== "true") {
    return NextResponse.json({ disabled: true, reason: "Automatiske 'vi kommer i morgen'-mails er midlertidigt stoppet — send manuelt indtil videre." });
  }

  const now = new Date();
  const todayStart = cphMidnightUtc(now, 0);   // i dag 00:00 dansk tid
  const tomorrowStart = cphMidnightUtc(now, 1); // i morgen 00:00 dansk tid
  const end = cphMidnightUtc(now, 2);           // overmorgen 00:00 dansk tid (eksklusiv)

  // Foretræk et præcist startAt; fald tilbage til plannedAt (dato-only, ingen
  // klokkeslæt i teksten) for ældre/manuelle ordrer uden et sat tidspunkt.
  // startAt-ordrer med et klokkeslæt der allerede er passeret i dag springes
  // over (gte: now) — en "vi kommer i dag"-mail efter besøget er støj.
  const due = await prisma.order.findMany({
    where: {
      reminderSentAt: null,
      status: "Afventer levering",
      OR: [
        { startAt: { gte: now, lt: end } },
        { startAt: null, plannedAt: { gte: todayStart, lt: end } },
      ],
    },
    include: { contact: true, tasks: true },
  });

  let sent = 0, skippedNoEmail = 0, failed = 0;
  for (const o of due) {
    if (!o.contact.email) { skippedNoEmail++; continue; }

    const claim = await prisma.order.updateMany({ where: { id: o.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claim.count === 0) continue; // en anden samtidig kørsel nåede den først

    // "i dag" eller "i morgen" afgøres af ordrens danske kalenderdag — aldrig
    // "i morgen" for en ordre der reelt ligger i dag (retry) eller omvendt.
    const dagOrd = (o.startAt ?? o.plannedAt) >= tomorrowStart ? "i morgen" : "i dag";
    const naar = o.startAt
      ? `omkring kl. ${new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(o.startAt)}`
      : "i løbet af dagen";
    const opgaver = o.tasks.map((t) => `- ${t.description}`).join("\n");
    const fornavn = o.contact.name.trim().split(/\s+/)[0] || o.contact.name;

    const res = await sendEmail({
      to: o.contact.email,
      subject: `Vi kommer ${dagOrd}`,
      text: [
        `Hej ${fornavn}`,
        ``,
        `Kort påmindelse: vi kommer forbi ${dagOrd}, ${naar}, på ${o.deliveryAddress}.`,
        ``,
        opgaver ? `Det drejer sig om:\n${opgaver}` : ``,
        ``,
        `Har du ikke tid alligevel, eller er der noget vi skal vide, så giv os et praj.`,
      ].filter(Boolean).join("\n"),
    });
    if (!res.ok) {
      failed++;
      // Rul tilbage — næste kørsel fanger ordren igen, fordi vinduet også
      // dækker "i dag" (retry-vinduet er konsistent med afsendelsesvinduet).
      await prisma.order.update({ where: { id: o.id }, data: { reminderSentAt: null } });
      console.error(`[reminders] afsendelse fejlede for ordre ${o.id}: ${res.error}`);
      continue;
    }
    sent++;
  }

  return NextResponse.json({ due: due.length, sent, skippedNoEmail, failed });
}
