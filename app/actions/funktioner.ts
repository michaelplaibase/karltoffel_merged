"use server";

// Server actions for the Funktioner pages: holiday planning (real CRUD — the
// HolidayWeek model exists and closes the planner for those weeks), group
// messages (recipient resolution is real; delivery is stubbed), subscription
// optimization and price adjustment.
import { prisma } from "@/lib/db";
import { regenerateFutureOrders } from "@/lib/recurrence";
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

// ---- Subscription optimization ---------------------------------------------

export type OptWeekLoad = { week: number; count: number };
export type OptProposal = { pk: number; displayNo: number; customer: string; fromWeek: number; toWeek: number };
export type OptimizationResult = { loads: OptWeekLoad[]; proposals: OptProposal[]; spread: number };

const weekNumOf = (s: { startWeek: string | null; nextWeek: string | null }): number | null => {
  const m = (s.startWeek || s.nextWeek || "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** Analyse how active subscriptions are spread across their start weeks and
 *  propose moving up to a few from the busiest week to the lightest, to even out
 *  the workload. Read-only — the moves are applied by applyOptimization. */
export async function computeOptimization(): Promise<OptimizationResult> {
  const subs = await prisma.subscription.findMany({ where: { active: true }, include: { contact: true } });
  const byWeek = new Map<number, { pk: number; displayNo: number; customer: string }[]>();
  for (const s of subs) {
    const wk = weekNumOf(s);
    if (wk == null) continue;
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk)!.push({ pk: s.id, displayNo: s.displayNo, customer: s.contact.name });
  }
  const loads = [...byWeek.entries()].map(([week, arr]) => ({ week, count: arr.length })).sort((a, b) => a.week - b.week);
  const counts = loads.map((l) => l.count);
  const spread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;

  const proposals: OptProposal[] = [];
  if (loads.length >= 2 && spread >= 2) {
    const busiest = [...loads].sort((a, b) => b.count - a.count)[0];
    const lightest = [...loads].sort((a, b) => a.count - b.count)[0];
    const movers = (byWeek.get(busiest.week) ?? []).slice(0, Math.min(3, Math.floor((busiest.count - lightest.count) / 2) || 1));
    for (const m of movers) proposals.push({ pk: m.pk, displayNo: m.displayNo, customer: m.customer, fromWeek: busiest.week, toWeek: lightest.week });
  }
  return { loads, proposals, spread };
}

/** Apply the optimization proposals: move each subscription's start week and
 *  regenerate its future orders. Customer notification (via `notify` channel) is
 *  stubbed and reflected in the returned message. */
export async function applyOptimization(pks: number[], toWeek: number, notify = "Både SMS og e-mail"): Promise<ActionState> {
  if (!pks.length) return { error: "Ingen abonnementer at flytte." };
  for (const pk of pks) {
    await prisma.subscription.update({ where: { id: pk }, data: { startWeek: `Uge ${toWeek}`, nextWeek: `Uge ${toWeek}` } });
    await regenerateFutureOrders(pk);
  }
  revalidatePath("/optimization");
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  const n = pks.length;
  const notice = notify === "Giv ikke besked" ? "Kunderne er ikke orienteret." : `Kunderne er orienteret via ${notify.toLowerCase()} (simuleret).`;
  return { ok: true, message: `${n} abonnement${n === 1 ? "" : "er"} flyttet til uge ${toWeek}. ${notice}` };
}

// ---- Price adjustment (Prisjustering) --------------------------------------

export type PriceAdj = { taskId: number; description: string; kind: string; oldPrice: number; newPrice: number };

function roundKr(v: number, mode: string): number {
  const r = (step: number) => Math.round(v / step) * step;
  switch (mode) {
    case "2 kr.": return r(2);
    case "5 kr.": return r(5);
    case "10 kr.": return r(10);
    case "Slut på 9,00 kr.":
    case "Slut på 9,95 kr.": return Math.max(0, Math.round(v / 10) * 10 - 1);
    default: return Math.round(v); // Ingen afrunding / 1 kr. / 50 øre
  }
}

/** Compute the price adjustment for the chosen scope: which task lines change and
 *  their new prices. Read-only — applied by applyPriceAdjustment. */
export async function computePriceAdjustment(percent: number, scope: string, rounding: string): Promise<PriceAdj[]> {
  const wantSub = !scope.includes("kun fastprisaftaler");
  const wantFixed = !scope.includes("kun abonnementer");
  const or = [
    ...(wantSub ? [{ subscriptionId: { not: null } }] : []),
    ...(wantFixed ? [{ fixedPriceId: { not: null } }] : []),
  ];
  if (!or.length) return [];
  const tasks = await prisma.taskLine.findMany({ where: { OR: or }, orderBy: { id: "asc" } });
  return tasks.map((t) => ({
    taskId: t.id, description: t.description,
    kind: t.subscriptionId ? "Abonnement" : "Fastprisaftale",
    oldPrice: t.price, newPrice: roundKr(t.price * (1 + percent / 100), rounding),
  }));
}

/** Apply a computed price adjustment (updates the task-line prices). */
export async function applyPriceAdjustment(adjustments: { taskId: number; newPrice: number }[]): Promise<ActionState> {
  if (!adjustments.length) return { error: "Ingen opgaver at justere." };
  await prisma.$transaction(adjustments.map((a) => prisma.taskLine.update({ where: { id: a.taskId }, data: { price: a.newPrice } })));
  revalidatePath("/subscriptions");
  revalidatePath("/fixed-prices");
  revalidatePath("/orders");
  return { ok: true, message: `Prisjustering gennemført for ${adjustments.length} opgave${adjustments.length === 1 ? "" : "r"}. Kunderne er orienteret (simuleret).` };
}
