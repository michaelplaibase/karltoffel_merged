"use server";
// Server actions for fravær (sygdom & ferie) — se lib/absence.ts for reglerne.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  registerAbsence, approveAbsence, rejectAbsence, parseAbsenceDate,
  type AbsenceType, type RegisterAbsenceResult,
} from "@/lib/absence";

async function guard(): Promise<{ id: number; isAdmin: boolean }> {
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  return { id: me.id, isAdmin: me.isAdmin };
}

/** Medarbejder (eller admin) melder sygdom/ferie for én dato. */
export async function registerAbsenceAction(type: AbsenceType, dateISO: string, note: string): Promise<RegisterAbsenceResult> {
  const me = await guard();
  const date = parseAbsenceDate(dateISO);
  if (!date) return { ok: false, message: "Vælg en gyldig dato." };
  const res = await registerAbsence(me.id, type, date, note.trim() || undefined);
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

/** Admin: registrér fravær på vegne af en medarbejder (web-formular). */
export async function registerForEmployeeAction(formData: FormData): Promise<void> {
  const me = await guard();
  if (!me.isAdmin) redirect("/");
  const userId = Number(formData.get("userId"));
  const type = String(formData.get("type")) as AbsenceType;
  const dateISO = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!Number.isInteger(userId) || (type !== "sygdom" && type !== "ferie")) return;
  const date = parseAbsenceDate(dateISO);
  if (!date) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  if (!u?.active) return;
  await registerAbsence(userId, type, date, note.trim() || undefined);
  revalidatePath("/fravaer");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
}