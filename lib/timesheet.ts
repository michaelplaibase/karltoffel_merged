// Tidsregistrering ("Check ind / Check ud") — dataadgang + formattering.
// Node-only (bruger Prisma). Sider/handlinger går gennem denne flade i stedet
// for at røre Prisma direkte, jf. resten af CRM'et.
import { prisma } from "@/lib/db";

const TZ = "Europe/Copenhagen";
const timeFmt = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat("da-DK", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });

// UTC-tidsstempel → dansk vægur ("08:32" / "man. 09.07").
export function cphTime(d: Date): string { return timeFmt.format(d); }
export function cphDate(d: Date): string { return dateFmt.format(d); }

// Varighed mellem to tidspunkter (eller til nu, hvis stadig åben) → "3 t 25 min".
export function varighed(inD: Date, outD: Date | null): string {
  const end = outD ?? new Date();
  const min = Math.max(0, Math.round((end.getTime() - inD.getTime()) / 60000));
  const t = Math.floor(min / 60), m = min % 60;
  return t > 0 ? `${t} t ${m} min` : `${m} min`;
}

// Brugerens aktuelle åbne registrering (checket ind, ikke ud endnu) — eller null.
export async function getOpenTimeEntry(userId: number) {
  return prisma.timeEntry.findFirst({
    where: { userId, checkOut: null },
    orderBy: { checkIn: "desc" },
  });
}

export type TimesheetRow = {
  id: number;
  navn: string;
  dato: string;
  ind: string;
  ud: string | null;
  varighed: string;
  aaben: boolean;
};

// Timeseddel-visning: admin ser alle medarbejdere, øvrige kun sig selv.
export async function getTimesheet(viewerId: number): Promise<{ isAdmin: boolean; rows: TimesheetRow[] }> {
  const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { isAdmin: true } });
  const isAdmin = !!viewer?.isAdmin;
  const entries = await prisma.timeEntry.findMany({
    where: isAdmin ? {} : { userId: viewerId },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { checkIn: "desc" },
    take: 100,
  });
  return {
    isAdmin,
    rows: entries.map((e) => ({
      id: e.id,
      navn: `${e.user.firstName} ${e.user.lastName}`.trim(),
      dato: cphDate(e.checkIn),
      ind: cphTime(e.checkIn),
      ud: e.checkOut ? cphTime(e.checkOut) : null,
      varighed: varighed(e.checkIn, e.checkOut),
      aaben: e.checkOut == null,
    })),
  };
}
