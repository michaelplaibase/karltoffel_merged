// Tidsregistrering ("Check ind / Check ud") — dataadgang + formattering.
// Node-only (bruger Prisma). Sider/handlinger går gennem denne flade i stedet
// for at røre Prisma direkte, jf. resten af CRM'et.
import { prisma } from "@/lib/db";

const TZ = "Europe/Copenhagen";
const timeFmt = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat("da-DK", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });
const dayIsoFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

// UTC-tidsstempel → dansk vægur ("08:32" / "man. 09.07").
export function cphTime(d: Date): string { return timeFmt.format(d); }
export function cphDate(d: Date): string { return dateFmt.format(d); }
// UTC-tidsstempel → dansk kalenderdato som "yyyy-mm-dd" (til dag-sammenligninger).
export function cphDayISO(d: Date): string { return dayIsoFmt.format(d); }

/** UTC-tidspunktet for et dansk vægur (dayISO = "yyyy-mm-dd" + tt:mm i
 *  Europe/Copenhagen). DST-sikker: startgættet ("som om DK var UTC") korrigeres
 *  iterativt mod det faktiske danske vægur i stedet for et antaget fast offset. */
export function utcFromCphWall(dayISO: string, hh: number, mm: number): Date {
  const [y, m, d] = dayISO.split("-").map(Number);
  const targetWall = Date.UTC(y, m - 1, d, hh, mm);
  const wallOf = (ts: number): number => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? "0");
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  };
  let ts = targetWall;
  for (let i = 0; i < 2; i++) ts += targetWall - wallOf(ts);
  return new Date(ts);
}

// Varighed mellem to tidspunkter (eller til nu, hvis stadig åben) → "3 t 25 min".
export function varighed(inD: Date, outD: Date | null): string {
  const end = outD ?? new Date();
  const min = Math.max(0, Math.round((end.getTime() - inD.getTime()) / 60000));
  const t = Math.floor(min / 60), m = min % 60;
  return t > 0 ? `${t} t ${m} min` : `${m} min`;
}

/** "Ud"-etiket for en registrering: klokkeslæt, med dags-markering ("+1 dag")
 *  når check-ud falder på en SENERE dansk kalenderdag end check-ind — ellers
 *  ligner en natvagt ("Ind 22:00 · Ud 02:30") en fejl i timesedlen. */
export function udLabel(inD: Date, outD: Date): string {
  const diff = Math.round((Date.parse(cphDayISO(outD)) - Date.parse(cphDayISO(inD))) / 864e5);
  return diff > 0 ? `${cphTime(outD)} (+${diff} ${diff === 1 ? "dag" : "dage"})` : cphTime(outD);
}

export type TimesheetRow = {
  id: number;
  dato: string;
  ind: string;
  ud: string | null;
  varighed: string;
  aaben: boolean;
};
export type TimesheetGroup = { userId: number; navn: string; rows: TimesheetRow[] };

// Seneste registreringer PR. MEDARBEJDER — et fælles take på tværs ville lade
// historikken skrumpe med antallet af ansatte (100 rækker delt af 5 mand ≈ 2 uger).
const PER_USER_LIMIT = 100;

// Timeseddel-visning: admin ser en sektion pr. medarbejder, øvrige kun sig selv.
export async function getTimesheet(viewerId: number): Promise<{ isAdmin: boolean; groups: TimesheetGroup[] }> {
  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { isAdmin: true } });
  const isAdmin = !!viewer?.isAdmin;
  const users = await prisma.user.findMany({
    where: isAdmin ? {} : { id: viewerId }, // også deaktiverede: deres historik hører med i opgørelsen
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const perUser = await Promise.all(
    users.map((u) =>
      prisma.timeEntry.findMany({
        where: { userId: u.id },
        orderBy: { checkIn: "desc" },
        take: PER_USER_LIMIT,
      }),
    ),
  );
  const groups = users.map((u, i) => ({
    userId: u.id,
    navn: `${u.firstName} ${u.lastName}`.trim(),
    rows: perUser[i].map((e) => ({
      id: e.id,
      dato: cphDate(e.checkIn),
      ind: cphTime(e.checkIn),
      ud: e.checkOut ? udLabel(e.checkIn, e.checkOut) : null,
      varighed: varighed(e.checkIn, e.checkOut),
      aaben: e.checkOut == null,
    })),
  }));
  // Admin: skjul medarbejdere helt uden registreringer (tomme sektioner støjer);
  // ens egen (evt. tomme) visning håndteres af sidens "Ingen registreringer endnu".
  return { isAdmin, groups: isAdmin ? groups.filter((g) => g.rows.length > 0) : groups };
}

// Brugerens aktuelle åbne registrering (checket ind, ikke ud endnu) — eller null.
// ÆLDSTE først: er der (legacy-)dubletter, er det den glemte gamle der skal frem.
export async function getOpenTimeEntry(userId: number) {
  return prisma.timeEntry.findFirst({
    where: { userId, checkOut: null },
    orderBy: { checkIn: "asc" },
  });
}
