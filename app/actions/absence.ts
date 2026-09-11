"use server";
// Server actions for fravær (sygdom & ferie) — se lib/absence.ts for reglerne.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  registerAbsencePeriod, approveAbsence, rejectAbsence, parseAbsenceDate,
  type AbsenceType, type RegisterAbsenceResult,
} from "@/lib/absence";

async function guard(): Promise<{ id: number; isAdmin: boolean }> {
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  return { id: me.id, isAdmin: me.isAdmin };
}

/** Medarbejder (eller admin) melder sygdom/ferie for én dato eller en periode (inklusiv). */
export async function registerAbsenceAction(
  type: AbsenceType,
  dateISO: string,
  note: string,
  toDateISO?: string,
): Promise<RegisterAbsenceResult> {
  const me = await guard();
  const date = parseAbsenceDate(dateISO);
  if (!date) return { ok: false, message: "Vælg en gyldig dato." };
  const toDate = toDateISO ? parseAbsenceDate(toDateISO) : undefined;
  if (toDateISO && !toDate) return { ok: false, message: "Slutdatoen er ugyldig." };
  const res = await registerAbsencePeriod(me.id, type, date, toDate ?? undefined, note.trim() || undefined);
  revalidatePath("/fravaer");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  return res;
}

/** Admin: godkend ferieansøgning. */
export async function approveAbsenceAction(absenceId: number): Promise<RegisterAbsenceResult> {
  const me = await guard();
  if (!me.isAdmin) redirect("/");
  const res = await approveAbsence(absenceId, me.id);
  revalidatePath("/fravaer");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  return res;
}

/** Admin: afvis ferieansøgning. */
export async function rejectAbsenceAction(absenceId: number): Promise<RegisterAbsenceResult> {
  const me = await guard();
  if (!me.isAdmin) redirect("/");
  const res = await rejectAbsence(absenceId, me.id);
  revalidatePath("/fravaer");
  return res;
}

/** Admin: registrér fravær på vegne af en medarbejder (web-formular, periode mulig). */
export async function registerForEmployeeAction(formData: FormData): Promise<void> {
  const me = await guard();
  if (!me.isAdmin) redirect("/");
  const userId = Number(formData.get("userId"));
  const type = String(formData.get("type")) as AbsenceType;
  const dateISO = String(formData.get("date") ?? "");
  const toDateISO = String(formData.get("toDate") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  if (!Number.isInteger(userId) || (type !== "sygdom" && type !== "ferie")) return;
  const date = parseAbsenceDate(dateISO);
  if (!date) return;
  const toDate = toDateISO ? parseAbsenceDate(toDateISO) : undefined;
  if (toDateISO && !toDate) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  if (!u?.active) return;
  await registerAbsencePeriod(userId, type, date, toDate ?? undefined, note.trim() || undefined);
  revalidatePath("/fravaer");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
}