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
// Idempotens: Order.reminderSentAt sættes FØR afsendelsen (samme mønster som
// tilbudsmailens tilbudSendtAt-værn), så en fejlslagen/gentaget cron-kørsel
// aldrig sender to påmindelser for samme ordre.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TZ = "Europe/Copenhagen";

/** UTC-interval der dækker "i morgen" (hele kalenderdøgnet) i København-tid. */
function tomorrowRangeCph(now: Date): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? "0");
  const todayUtcNoon = Date.UTC(get("year"), get("month") - 1, get("day"), 12); // DST-sikkert ankerpunkt
  const start = new Date(todayUtcNoon + 12 * 3600 * 1000); // i morgen 00:00 CPH ≈ i dag 24:00 — fanges af selve intervallet uanset DST
  const end = new Date(start.getTime() + 36 * 3600 * 1000);
  return { start, end };
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  if (!isCron && (await requireSession()) == null) return unauthorized();

  const { start, end } = tomorrowRangeCph(new Date());

  // Foretræk et præcist startAt; fald tilbage til plannedAt (dato-only, ingen
  // klokkeslæt i teksten) for ældre/manuelle ordrer uden et sat tidspunkt.
  const due = await prisma.order.findMany({
    where: {
      reminderSentAt: null,
      status: "Afventer levering",
      OR: [{ startAt: { gte: start, lt: end } }, { startAt: null, plannedAt: { gte: start, lt: end } }],
    },
    include: { contact: true, tasks: true },
  });

  let sent = 0, skippedNoEmail = 0, failed = 0;
  for (const o of due) {
    if (!o.contact.email) { skippedNoEmail++; continue; }

    const claim = await prisma.order.updateMany({ where: { id: o.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claim.count === 0) continue; // en anden samtidig kørsel nåede den først

    const naar = o.startAt
      ? `omkring kl. ${new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(o.startAt)}`
      : "i løbet af dagen";
    const opgaver = o.tasks.map((t) => `- ${t.description}`).join("\n");
    const fornavn = o.contact.name.trim().split(/\s+/)[0] || o.contact.name;

    const res = await sendEmail({
      to: o.contact.email,
      subject: "Vi kommer i morgen",
      text: [
        `Hej ${fornavn}`,
        ``,
        `Kort påmindelse: vi kommer forbi i morgen, ${naar}, på ${o.deliveryAddress}.`,
        ``,
        opgaver ? `Det drejer sig om:\n${opgaver}` : ``,
        ``,
        `Har du ikke tid alligevel, eller er der noget vi skal vide, så giv os et praj.`,
      ].filter(Boolean).join("\n"),
    });
    if (!res.ok) {
      failed++;
      await prisma.order.update({ where: { id: o.id }, data: { reminderSentAt: null } }); // rul tilbage, prøv igen i morgen
      console.error(`[reminders] afsendelse fejlede for ordre ${o.id}: ${res.error}`);
      continue;
    }
    sent++;
  }

  return NextResponse.json({ due: due.length, sent, skippedNoEmail, failed });
}
