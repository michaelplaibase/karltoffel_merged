// Fravær (sygdom & ferie) — fælles logik for registrering, godkendelse,
// e-mail-notifikation og planlægnings-flytning (Thomas, 2026-09-10).
//
// Regler (aftalt med Thomas):
// - Sygdom: én dag ad gangen, gælder STRAKS (ingen godkendelse).
// - Ferie: ansøgning — admin skal godkende. Først EFTER godkendelse planlægges.
// - Hver registrering (og godkendelse) sender e-mail til kontoret.
// - Ved godkendt ferie/sygdom: opgaver planlagt den pågældende dato for den
//   fraværende medarbejder flyttes automatisk til en anden ledig dag (10:00).
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export type AbsenceType = "sygdom" | "ferie";
export type AbsenceStatus = "registered" | "pending" | "approved" | "rejected";

const STAFF_EMAIL = process.env.STAFF_NOTIFY_EMAIL?.trim() || "kristian@karltoffel.dk";

const dateISO = (d: Date) => d.toISOString().slice(0, 10);
const daDate = (d: Date) =>
  new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);

/** Parse en YYYY-MM-DD-streng til midnat UTC — null hvis ugyldig. */
export function parseAbsenceDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function notifyStaff(subject: string, text: string): Promise<void> {
  try {
    const res = await sendEmail({ to: STAFF_EMAIL, subject, text });
    if (!res.ok) console.error(`[fravaer] e-mail fejlede: ${res.error}`);
  } catch (e) {
    console.error("[fravaer] e-mail exception:", e);
  }
}

/**
 * Flyt medarbejderens ikke-låste, ikke-udførte ordrer væk fra `date` til den
 * ledige dag med mindst belastning i de følgende 7 dage (samme medarbejder).
 * Returnerer antal flyttede ordrer. Manuelle ordre-flyt og låste ordrer røres
 * ikke — planlæggeren genskaber ellers rytmen.
 */
export async function moveOrdersAwayFrom(userId: number, date: Date): Promise<number> {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 864e5);
  const orders = await prisma.order.findMany({
    where: {
      employeeId: userId,
      plannedAt: { gte: start, lt: end },
      lockedFully: false,
      status: "Afventer levering",
    },
    select: { id: true, plannedAt: true },
  });
  let moved = 0;
  for (const o of orders) {
    const base = new Date(o.plannedAt.getTime() + 864e5);
    // Find den første af de følgende 7 dage uden allerede-planlagte ordrer for
    // medarbejderen — og undgå at lande på en anden fraværsdag.
    let target: Date | null = null;
    for (let i = 0; i < 7; i++) {
      const cand = new Date(base.getTime() + i * 864e5);
      const candISO = dateISO(cand);
      const [busy, absent] = await Promise.all([
        prisma.order.count({
          where: { employeeId: userId, plannedAt: { gte: cand, lt: new Date(cand.getTime() + 864e5) } },
        }),
        prisma.absence.count({
          where: {
            userId, date: cand,
            OR: [{ type: "sygdom", status: "registered" }, { type: "ferie", status: "approved" }],
          },
        }),
      ]);
      if (busy === 0 && absent === 0) { target = cand; break; }
    }
    if (!target) continue;
    await prisma.order.update({
      where: { id: o.id },
      data: { plannedAt: new Date(`${dateISO(target)}T10:00:00Z`) },
    });
    moved += 1;
  }
  return moved;
}

export type RegisterAbsenceResult = { ok: boolean; message: string };

/**
 * Registrér fravær for en PERIODE (inklusiv): dag for dag fra `from` til `to`
 * (to default = from, dvs. én dag). Sygdom → "registered" + straks-planlægning
 * pr. dag. Ferie → "pending" (ansøgning; admin godkender). Eksisterende
 * registreringer samme dato/type ændres IKKE (idempotent) — kun nyoprettede
 * dage tæller med og flytter opgaver + udsender e-mail.
 */
export async function registerAbsencePeriod(
  userId: number,
  type: AbsenceType,
  from: Date,
  to?: Date,
  note?: string,
): Promise<RegisterAbsenceResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, active: true } });
  if (!user?.active) return { ok: false, message: "Brugeren findes ikke eller er deaktiveret." };

  const status: AbsenceStatus = type === "sygdom" ? "registered" : "pending";
  const end = to ?? from;
  if (end.getTime() < from.getTime()) return { ok: false, message: "Slutdatoen må ikke være før startdatoen." };

  let created = 0;
  let movedTotal = 0;
  for (let d = new Date(from); d.getTime() <= end.getTime(); d = new Date(d.getTime() + 864e5)) {
    const res = await prisma.absence.upsert({
      where: { userId_type_date: { userId, type, date: d } },
      create: { userId, type, date: new Date(d), status, note: note ?? null },
      update: {}, // eksisterende registrering samme dato ændres ikke
    });
    // upsert returnerer rækken — kun NYOPRETTET tæller (createdAt ≈ nu)
    if (Date.now() - res.createdAt.getTime() < 5000) {
      created += 1;
      if (type === "sygdom") movedTotal += await moveOrdersAwayFrom(userId, d);
    }
  }

  const navn = `${user.firstName} ${user.lastName}`.trim();
  const periode = daDate(from) === daDate(end) ? daDate(from) : `${daDate(from)} — ${daDate(end)}`;
  await notifyStaff(
    type === "sygdom" ? `Sygdom meldt: ${navn} — ${periode}` : `Ferieansøgning: ${navn} — ${periode}`,
    type === "sygdom"
      ? `${navn} har meldt sig syg: ${periode}.${note ? `\n\nBesked: ${note}` : ""}${
          movedTotal ? `\n\n${movedTotal} planlagt(e) opgave(r) er automatisk flyttet til andre dage.` : ""
        }`
      : `${navn} har ansøgt om ferie: ${periode} (${created} dag(e)).${note ? `\n\nBesked: ${note}` : ""}\n\nGodkend/afvis under Funktioner → Fravær i CRM'en.`,
  );

  return {
    ok: true,
    message:
      type === "sygdom"
        ? `Sygdom registreret: ${periode}. Kontoret er sendt en e-mail.${movedTotal ? ` ${movedTotal} opgave(r) flyttet automatisk.` : ""}`
        : created === 0
          ? `Alle dage i perioden er allerede registreret — intet ændret.`
          : `Ferieansøgning sendt: ${periode} (${created} dag(e)). Kontoret er sendt en e-mail — du hører, når den er godkendt.`,
  };
}

/**
 * Registrér fravær. Sygdom → status "registered" + straks-planlægning.
 * Ferie → status "pending" (ansøgning; admin godkender).
 */
export async function registerAbsence(
  userId: number,
  type: AbsenceType,
  date: Date,
  note?: string,
): Promise<RegisterAbsenceResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, active: true } });
  if (!user?.active) return { ok: false, message: "Brugeren findes ikke eller er deaktiveret." };

  const status: AbsenceStatus = type === "sygdom" ? "registered" : "pending";
  await prisma.absence.upsert({
    where: { userId_type_date: { userId, type, date } },
    create: { userId, type, date, status, note: note ?? null },
    update: { status, note: note ?? null, decidedBy: null, decidedAt: null },
  });

  const navn = `${user.firstName} ${user.lastName}`.trim();
  const dato = daDate(date);
  let flyttet = 0;
  if (type === "sygdom") flyttet = await moveOrdersAwayFrom(userId, date);

  await notifyStaff(
    type === "sygdom" ? `Sygdom meldt: ${navn} — ${dato}` : `Ferieansøgning: ${navn} — ${dato}`,
    type === "sygdom"
      ? `${navn} har meldt sig syg ${dato}.${note ? `\n\nBesked: ${note}` : ""}${
          flyttet ? `\n\n${flyttet} planlagt(e) opgave(r) er automatisk flyttet til en anden dag.` : ""
        }`
      : `${navn} har ansøgt om ferie ${dato}.${note ? `\n\nBesked: ${note}` : ""}\n\nGodkend afvis ferie under Funktioner → Fravær i CRM'en.`,
  );

  return {
    ok: true,
    message:
      type === "sygdom"
        ? `Sygdom registreret for ${daDate(date)}. Kontoret er blevet sendt en e-mail.${flyttet ? ` ${flyttet} opgave(r) flyttet automatisk.` : ""}`
        : `Ferieansøgning sendt for ${daDate(date)}. Kontoret er blevet sendt en e-mail — du hører, når den er godkendt.`,
  };
}

/** Admin: godkend en ferieansøgning → flyt opgaver + bekræftelse til kontoret. */
export async function approveAbsence(absenceId: number, adminId: number): Promise<RegisterAbsenceResult> {
  const a = await prisma.absence.findUnique({
    where: { id: absenceId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!a || a.type !== "ferie") return { ok: false, message: "Ferieansøgningen findes ikke." };
  await prisma.absence.update({
    where: { id: absenceId },
    data: { status: "approved", decidedBy: adminId, decidedAt: new Date() },
  });
  const flyttet = await moveOrdersAwayFrom(a.userId, a.date);
  const navn = `${a.user.firstName} ${a.user.lastName}`.trim();
  await notifyStaff(
    `Ferie GODKENDT: ${navn} — ${daDate(a.date)}`,
    `Ferieansøgningen for ${navn} ${daDate(a.date)} er godkendt.${flyttet ? ` ${flyttet} opgave(r) flyttet automatisk til en anden dag.` : ""}`,
  );
  return { ok: true, message: `Ferie godkendt${flyttet ? ` — ${flyttet} opgave(r) flyttet` : ""}.` };
}

/** Admin: afvis en ferieansøgning. */
export async function rejectAbsence(absenceId: number, adminId: number): Promise<RegisterAbsenceResult> {
  const a = await prisma.absence.findUnique({
    where: { id: absenceId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!a || a.type !== "ferie") return { ok: false, message: "Ferieansøgningen findes ikke." };
  await prisma.absence.update({
    where: { id: absenceId },
    data: { status: "rejected", decidedBy: adminId, decidedAt: new Date() },
  });
  const navn = `${a.user.firstName} ${a.user.lastName}`.trim();
  await notifyStaff(`Ferie AFVIST: ${navn} — ${daDate(a.date)}`, `Ferieansøgningen for ${navn} ${daDate(a.date)} er blevet afvist.`);
  return { ok: true, message: "Ferie afvist." };
}

/** Fraværsdage for én medarbejder (til lønrapport mv.). */
export async function absencesForUser(userId: number, fromISO: string, toISO: string) {
  return prisma.absence.findMany({
    where: {
      userId,
      date: { gte: new Date(`${fromISO}T00:00:00Z`), lte: new Date(`${toISO}T23:59:59.999Z`) },
      OR: [{ type: "sygdom" }, { status: "approved" }],
    },
    orderBy: { date: "asc" },
  });
}
