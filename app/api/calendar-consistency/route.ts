import { NextResponse } from "next/server";
import { checkWeekConsistency } from "@/lib/calendar-consistency";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { weekMondayToday } from "@/lib/calendar";
import { sendEmail } from "@/lib/email";

// GET /api/calendar-consistency
// Natligt VAGTVÆRN (se vercel.json — kører efter /api/plan): verificerer mod
// den LEVENDE database, at dagskalenderen og den overordnede kalender er 100 %
// synkrone for indeværende + næste uge — hver ordre vises præcis én gang
// (planlagt eller "Ikke planlagt"), dag==uge på id og klokkeslæt, og tallene
// stemmer. Skrider invarianten: (1) console.error → fejlen lander i Vercels
// runtime-overvågning, (2) alarm-mail til kontoret. Svarer altid 200 med
// status-JSON (kun tal/id'er — ingen kundedata), så cron'en ikke retry-spammer.
//
// Access: Vercel-cron (Authorization: Bearer <CRON_SECRET>) eller logget-ind
// bruger — samme mønster som /api/plan.
const STAFF_EMAIL = process.env.STAFF_NOTIFY_EMAIL?.trim() || "kristian@karltoffel.dk";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  if (!isCron && (await requireSession()) == null) return unauthorized();

  const monday = weekMondayToday();
  const nextMonday = new Date(Date.parse(`${monday}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10);
  const weeks = await Promise.all([checkWeekConsistency(monday), checkWeekConsistency(nextMonday)]);
  const broken = weeks.filter((w) => !w.ok);

  if (broken.length) {
    const detail = broken
      .map((w) => `Uge ${w.week} (${w.orders} ordrer i DB, ${w.planned} planlagt, ${w.unplanned} ikke planlagt):\n` +
        w.problems.map((p) => `  - [${p.kind}] ${p.detail}`).join("\n"))
      .join("\n\n");
    console.error(`[kalender-konsistens] INVARIANT BRUDT — dagskalender og kalender er IKKE synkrone:\n${detail}`);
    try {
      const res = await sendEmail({
        to: STAFF_EMAIL,
        subject: "⚠️ Karltoffel: kalender og dagsprogram er ude af sync",
        text:
          "Det natlige konsistens-tjek fandt uoverensstemmelser mellem den overordnede kalender og dagsprogrammet.\n\n" +
          detail +
          "\n\nÅbn kalenderen og dagsprogrammet for ugen og sammenlign — fejlen er også logget i produktions-overvågningen.",
      });
      if (!res.ok) console.error(`[kalender-konsistens] alarm-mail fejlede: ${res.error}`);
    } catch (e) {
      console.error("[kalender-konsistens] alarm-mail exception:", e);
    }
  }

  return NextResponse.json({ ok: broken.length === 0, weeks });
}
