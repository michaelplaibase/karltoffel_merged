"use server";

// Tidsregistrering: "Check ind / Check ud" (til/fra arbejde).
// Node-only server actions. Hver handling guarder sig selv, da middleware
// undtager server-action-POSTs. Højst én åben registrering per bruger håndhæves
// ATOMISK med en advisory lock pr. bruger (samme mønster som lib/dinero.ts's
// pr.-ordre-lås): find-then-create alene er IKKE atomisk ved Postgres' default
// READ COMMITTED — to samtidige "Check ind" (telefon + desktop) ville ellers
// begge se "ingen åben" og oprette hver sin række. Skemaet har (bevidst) intet
// partial unique index, så låsen er værnet.
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cphDate, cphTime, cphDayISO, utcFromCphWall } from "@/lib/timesheet";

// Eget nøglerum til bruger-låsen: to-argument-formen af pg_advisory_xact_lock
// deler ikke nøglerum med en-argument-formen, som lib/dinero.ts bruger pr. ordre.
const TIME_LOCK_NS = 421001;

// Åbn en registrering, hvis brugeren ikke allerede er checket ind.
export async function checkIn(): Promise<void> {
  // getSessionUser (ikke requireSession): en DEAKTIVERET brugers token er
  // ellers gyldigt i op til 30 dage — active-tjekket gælder også tid.
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  const userId = me.id;
  await prisma.$transaction(async (tx) => {
    // Serialisér pr. bruger — låsen frigives automatisk ved commit/rollback.
    // ::int-casts er PÅKRÆVEDE: Prisma binder JS-tal som bigint, og
    // to-argument-formen findes kun som (int4, int4).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TIME_LOCK_NS}::int, ${userId}::int)`;
    const open = await tx.timeEntry.findFirst({ where: { userId, checkOut: null } });
    if (!open) await tx.timeEntry.create({ data: { userId } });
  });
  revalidatePath("/daycalendar");
  revalidatePath("/timesheet");
}

// Luk ALLE brugerens åbne registreringer (normalt én). updateMany er ét atomisk
// statement og lukker også evt. dubletter fra før race-værnet, så ingen række
// bliver hængende som "Åben" og tæller timer i det uendelige.
export async function checkOut(): Promise<void> {
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  const userId = me.id;
  await prisma.timeEntry.updateMany({ where: { userId, checkOut: null }, data: { checkOut: new Date() } });
  revalidatePath("/daycalendar");
  revalidatePath("/timesheet");
}

export type OpenEntryInfo = { dato: string; tid: string; sammeDag: boolean } | null;

// Detaljer om den åbne registrering til CheckInOut-badgen: dansk dato + tid,
// og om check-ind er fra I DAG. Ældste åbne først — er der dubletter, er det
// den glemte gamle registrering brugeren skal se og lukke.
export async function getOpenEntryInfo(): Promise<OpenEntryInfo> {
  const me = await getSessionUser();
  if (me == null) return null;
  const userId = me.id;
  const open = await prisma.timeEntry.findFirst({ where: { userId, checkOut: null }, orderBy: { checkIn: "asc" } });
  if (!open) return null;
  return {
    dato: cphDate(open.checkIn),
    tid: cphTime(open.checkIn),
    sammeDag: cphDayISO(open.checkIn) === cphDayISO(new Date()),
  };
}

// React 19: ukontrollerede formularer nulstilles når en action returnerer —
// fejl-returer ekkoer derfor den indsendte sluttid i state.values.
export type CheckOutAtState = { error?: string; ok?: boolean; values?: { tid: string } };

// "Glemte du at tjekke ud?" — luk en glemt åben registrering med en ANGIVET
// sluttid på check-ind-dagen (dansk tid), så en kæmpe-vagt frem til "nu" ikke
// er eneste udvej. Sluttiden valideres: samme danske dag som check-ind (pr.
// konstruktion), efter check-ind og ikke i fremtiden.
export async function checkOutAt(_prev: CheckOutAtState, formData: FormData): Promise<CheckOutAtState> {
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  const userId = me.id;
  const tid = String(formData.get("tid") ?? "").trim();
  const values = { tid };
  const m = tid.match(/^(\d{1,2}):(\d{2})$/);
  const hh = m ? Number(m[1]) : NaN;
  const mm = m ? Number(m[2]) : NaN;
  if (!m || hh > 23 || mm > 59) return { error: "Angiv en gyldig sluttid (tt:mm).", values };

  const open = await prisma.timeEntry.findFirst({ where: { userId, checkOut: null }, orderBy: { checkIn: "asc" } });
  if (!open) {
    // Allerede lukket (fx i en anden fane) — intet at gøre.
    revalidatePath("/daycalendar");
    revalidatePath("/timesheet");
    return { ok: true };
  }
  // Sluttiden lægges på check-ind-dagen (dansk tid). En NATVAGT (ind 22:00,
  // ud 02:30) giver et klokkeslæt FØR check-ind — så gælder tiden dagen efter.
  const dayISO = cphDayISO(open.checkIn);
  const nextDayISO = new Date(Date.parse(`${dayISO}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  let slut = utcFromCphWall(dayISO, hh, mm);
  if (slut.getTime() <= open.checkIn.getTime()) slut = utcFromCphWall(nextDayISO, hh, mm);
  if (slut.getTime() <= open.checkIn.getTime()) {
    return { error: `Sluttiden skal være efter check ind kl. ${cphTime(open.checkIn)} (${cphDate(open.checkIn)}).`, values };
  }
  if (slut.getTime() > Date.now()) return { error: "Sluttiden ligger i fremtiden.", values };

  // Luk kun de åbne rækker sluttiden reelt dækker (checkIn <= slut) — en evt.
  // nyere åben registrering fra i dag skal ikke have en sluttid fra i går.
  await prisma.timeEntry.updateMany({
    where: { userId, checkOut: null, checkIn: { lte: slut } },
    data: { checkOut: slut },
  });
  revalidatePath("/daycalendar");
  revalidatePath("/timesheet");
  return { ok: true };
}
