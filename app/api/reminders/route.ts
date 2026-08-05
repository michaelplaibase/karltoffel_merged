import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { requireSession, unauthorized } from "@/lib/api-auth";

// "Vi kommer i morgen"-påmindelse. Kører hyppigt (se vercel.json — hver 30.
// minut, IKKE en gang i døgnet som /api/plan), fordi et besøg kan ligge når
// som helst i arbejdsdagen (07:00–15:00): en engangs-daglig cron ville give op
// til et døgns fejlmargin på hvornår "24 timer før" reelt rammes. Et 30-min-
// vindue omkring nøjagtig 24 timer før startAt fanger hvert besøg præcis én
// gang (idempotens via reminderSentAt, sat FØR afsendelsen — samme mønster som
// tilbudsmailens tilbudSendtAt-værn mod dobbeltklik/dobbelt-cron).
//
// KUN ordrer med et præcist startAt (ikke det ældre dato-only plannedAt) kan
// få en tidssat påmindelse — se prisma-kommentaren på Order.startAt. Ordrer
// uden startAt tælles og logges, men springes bevidst over frem for at gætte
// et klokkeslæt og sende en forkert påmindelse.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const WINDOW_MS = 30 * 60 * 1000; // matcher cron-intervallet i vercel.json
const REMINDER_HOURS_BEFORE = 24;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  if (!isCron && (await requireSession()) == null) return unauthorized();

  const now = Date.now();
  const target = now + REMINDER_HOURS_BEFORE * 3600 * 1000;
  const windowStart = new Date(target - WINDOW_MS / 2);
  const windowEnd = new Date(target + WINDOW_MS / 2);

  const due = await prisma.order.findMany({
    where: {
      startAt: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null,
      status: "Afventer levering",
    },
    include: { contact: true, tasks: true },
  });

  const skippedNoStartAt = await prisma.order.count({
    where: { startAt: null, reminderSentAt: null, status: "Afventer levering", plannedAt: { gte: windowStart, lte: windowEnd } },
  });

  let sent = 0, skippedNoEmail = 0, failed = 0;
  for (const o of due) {
    if (!o.contact.email) { skippedNoEmail++; continue; }

    // Markér FØR afsendelsen — samme dobbeltklik/dobbelt-cron-værn som tilbudsmailen.
    const claim = await prisma.order.updateMany({ where: { id: o.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claim.count === 0) continue; // en anden samtidig kørsel nåede den først

    const tid = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }).format(o.startAt!);
    const dato = new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Copenhagen" }).format(o.startAt!);
    const opgaver = o.tasks.map((t) => `- ${t.description}`).join("\n");
    const fornavn = o.contact.name.trim().split(/\s+/)[0] || o.contact.name;

    const res = await sendEmail({
      to: o.contact.email,
      subject: `Vi kommer i morgen — ${dato.charAt(0).toUpperCase() + dato.slice(1)} kl. ${tid}`,
      text: [
        `Hej ${fornavn}`,
        ``,
        `Kort påmindelse: vi kommer forbi ${dato} omkring kl. ${tid} på ${o.deliveryAddress}.`,
        ``,
        opgaver ? `Det drejer sig om:\n${opgaver}` : ``,
        ``,
        `Har du ikke tid alligevel, eller er der noget vi skal vide, så giv os et praj.`,
      ].filter(Boolean).join("\n"),
    });
    if (!res.ok) {
      failed++;
      // Rul markeringen tilbage så en senere kørsel kan prøve igen.
      await prisma.order.update({ where: { id: o.id }, data: { reminderSentAt: null } });
      console.error(`[reminders] afsendelse fejlede for ordre ${o.id}: ${res.error}`);
      continue;
    }
    sent++;
  }

  return NextResponse.json({ due: due.length, sent, skippedNoEmail, skippedNoStartAt, failed });
}
