"use server";

// Server actions for the Funktioner pages: holiday planning (real CRUD — the
// HolidayWeek model exists and closes the planner for those weeks), group
// messages (recipient resolution is real; delivery is stubbed), subscription
// optimization and price adjustment.
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ActionState = { error?: string; ok?: boolean; message?: string };

// ---- Holidays --------------------------------------------------------------

export async function createHoliday(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const start = String(formData.get("startWeek") ?? "");
  const end = String(formData.get("endWeek") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { error: "Vælg start- og slutuge." };
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (e < s) return { error: "Slutugen skal være efter eller lig med startugen." };
  await prisma.holidayWeek.create({ data: { startWeek: s, endWeek: e } });
  revalidatePath("/holidays");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  return { ok: true, message: "Ferie oprettet. Kalenderen er lukket i de valgte uger." };
}

export async function deleteHoliday(id: number): Promise<void> {
  await prisma.holidayWeek.delete({ where: { id } });
  revalidatePath("/holidays");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
}

// ---- Group messages --------------------------------------------------------

export type Recipient = { name: string; email: string; phone: string };

/** Resolve the customers a group message would reach — real DB query keyed off
 *  the chosen Kundegruppe (+ Dato/Uge). Used by both "Vis modtagere" and Send. */
export async function resolveRecipients(group: string, dateISO: string, weekISO: string): Promise<Recipient[]> {
  const g = (group || "").toLowerCase();
  const ids = new Set<number>();
  const notDone = g.includes("ikke-afsluttede") ? { status: { not: "Afsluttet" } } : {};
  const activeSubContactIds = async () => new Set((await prisma.subscription.findMany({ where: { active: true }, select: { contactId: true } })).map((s) => s.contactId));

  if (g.includes("dato") && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    const s = new Date(`${dateISO}T00:00:00Z`), e = new Date(s.getTime() + 864e5);
    (await prisma.order.findMany({ where: { plannedAt: { gte: s, lt: e }, ...notDone }, select: { contactId: true } })).forEach((o) => ids.add(o.contactId));
  } else if (g.includes("uge") && /^\d{4}-\d{2}-\d{2}$/.test(weekISO)) {
    const s = new Date(`${weekISO}T00:00:00Z`), e = new Date(s.getTime() + 7 * 864e5);
    (await prisma.order.findMany({ where: { plannedAt: { gte: s, lt: e }, ...notDone }, select: { contactId: true } })).forEach((o) => ids.add(o.contactId));
  } else if (g.includes("abonnementskunder")) {
    (await activeSubContactIds()).forEach((id) => ids.add(id));
  } else if (g.includes("online")) {
    (await prisma.order.findMany({ where: { sourceType: "online" }, select: { contactId: true } })).forEach((o) => ids.add(o.contactId));
  } else if (g.includes("manuel")) {
    (await prisma.order.findMany({ where: { sourceType: "manual" }, select: { contactId: true } })).forEach((o) => ids.add(o.contactId));
  } else {
    (await prisma.contact.findMany({ where: { OR: [{ orders: { some: {} } }, { subscriptions: { some: {} } }] }, select: { id: true } })).forEach((c) => ids.add(c.id));
  }
  if (g.includes("uden abonnement")) {
    const subbed = await activeSubContactIds();
    for (const id of [...ids]) if (subbed.has(id)) ids.delete(id);
  }

  const contacts = await prisma.contact.findMany({ where: { id: { in: [...ids] } }, orderBy: { name: "asc" } });
  return contacts.map((c) => ({ name: c.name, email: c.email ?? "", phone: c.phone ?? "" }));
}

/** Send a group message. Recipient resolution is real; the actual e-mail/SMS
 *  delivery is stubbed (no provider in this internal clone). */
export async function sendGroupMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const group = String(formData.get("group") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!group) return { error: "Vælg en kundegruppe." };
  if (!body) return { error: "Skriv en besked." };
  const recipients = await resolveRecipients(group, String(formData.get("date") ?? ""), String(formData.get("week") ?? ""));
  if (!recipients.length) return { error: "Ingen modtagere matcher den valgte kundegruppe." };
  return { ok: true, message: `Beskeden er sendt til ${recipients.length} modtager${recipients.length === 1 ? "" : "e"} (simuleret).` };
}
