"use server";

// Server actions for orders: create a manual order, and the "Afslut ordre"
// (complete order) flow.
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { planAndPersistWeek } from "@/lib/queries";
import { categoryColor } from "@/lib/categories";
import { isInvoiceDecision, issueInvoiceForOrder } from "@/lib/dinero";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayCphISO, weekMondayToday } from "@/lib/calendar";

// `values` ekkoer de indsendte felter tilbage ved valideringsfejl: React 19
// nulstiller ukontrollerede formularfelter når en server action returnerer, så
// formularen prefiller defaultValue fra state.values og bevarer indtastningen.
export type OrderCreateState = { error?: string; values?: { week: string; employeeId: string } };

/** Read the repeated task-line fields (aligned by index) from the form. */
function readTaskLines(formData: FormData) {
  const descs = formData.getAll("taskDescription").map(String);
  const prices = formData.getAll("taskPrice").map((v) => Number(v) || 0);
  const durs = formData.getAll("taskDuration").map((v) => Number(v) || 0);
  const cats = formData.getAll("taskCategory").map(String);
  return descs
    .map((d, i) => ({ description: d.trim(), price: prices[i] || 0, durationMin: durs[i] || 0, category: cats[i] || "Andet" }))
    .filter((l) => l.description);
}

export async function createOrder(_prev: OrderCreateState, formData: FormData): Promise<OrderCreateState> {
  await guardAction();
  const week = String(formData.get("week") ?? "");
  const employeeIdRaw = String(formData.get("employeeId") ?? "").trim();
  const values = { week, employeeId: employeeIdRaw }; // ekkoes ved fejl, så uge/medarbejder-valget overlever React 19's form-reset
  const contactId = Number(formData.get("contactId"));
  if (!contactId) return { error: "Vælg en kunde.", values };
  const lines = readTaskLines(formData);
  if (!lines.length) return { error: "Tilføj mindst én opgave.", values };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet.", values };

  // Planlagt tidspunkt: vælges INDEVÆRENDE uge (eller ingen uge), plantes
  // ordren på DAGS DATO (Europe/Copenhagen) kl. 10 UTC — ikke ugens mandag,
  // som midt i ugen ligger i fortiden og straks markerede ordren "forfalden".
  // Fremtidige uger planter fortsat på ugens mandag; planneren ruter derefter.
  const todayAt10 = new Date(`${todayCphISO()}T10:00:00Z`);
  const plannedAt = week && week !== weekMondayToday() ? new Date(`${week}T10:00:00Z`) : todayAt10;
  // Medarbejder: eksplicit valg fra formularen, hvis sat. Ellers falder vi
  // tilbage til FØRSTE aktive bruger — samme konvention som abonnementers
  // "Ingen"/fixedEmployee (se lib/recurrence.ts defaultEmployeeId) — IKKE null:
  // buildWeekPlan (lib/queries.ts) ruter kun ordrer med et sat employeeId
  // gennem planneren; en null-værdi lander i "unplanned (unassigned)" og bliver
  // slet ikke planlagt. Pointen med fixet her er at få ÉT bestemt employeeId
  // sat (så kun den medarbejder ser opgaven, jf. getDayProgram-filtret) — ikke
  // at fjerne tildelingen. Vælger man en medarbejder i dropdownen, bruges den.
  const employeeId = employeeIdRaw
    ? Number(employeeIdRaw) || null
    : (await prisma.user.findFirst({ where: { active: true }, orderBy: { id: "asc" } }))?.id ?? null;

  const order = await prisma.order.create({
    data: {
      contactId,
      deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
      plannedAt,
      sourceType: "manual",
      employeeId,
      status: "Afventer levering",
      tasks: {
        create: lines.map((l, i) => ({
          category: l.category, letter: (l.category[0] ?? "A").toUpperCase(), color: categoryColor(l.category),
          description: l.description, price: l.price, durationMin: l.durationMin, sort: i,
        })),
      },
    },
  });

  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect(`/orders/${order.id}`);
}

// `values` ekkoer de indsendte felter ved fejl (samme mønster som
// OrderCreateState): React 19 nulstiller ukontrollerede felter når action'en
// returnerer, så CompleteOrderForm prefiller defaultValue/defaultChecked fra
// state.values — medarbejderens indtastning må aldrig gå tabt ved en fejl.
export type CompleteOrderState = {
  error?: string;
  values?: { leveringsstatus: string; betaling: string; comment: string; addressNote: string };
};

// Leveringsstatus radio value -> stored order status.
const STATUS: Record<string, string> = {
  udfoert: "Udført",
  skip: "Sprunget over",
  replan: "Skal genplanlægges",
  other: "Anden status",
};

/** Delete an order and its task lines. `redirectTo=null` stays on the current
 *  page (used by the calendar), otherwise navigates there (lists default to /orders).
 *  Abonnements-ordrer efterlader en uge-tombstone, så natte-genereringen ikke
 *  genopliver den slettede uge (lib/recurrence.ts respekterer SubscriptionWeekSkip). */
export async function deleteOrder(orderId: number, redirectTo: string | null = "/orders"): Promise<void> {
  await guardAction();
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { subscriptionId: true, sourceWeek: true, plannedAt: true, contactId: true },
  });
  if (!o) return;
  const week = o.sourceWeek ?? mondayOfUTC(o.plannedAt); // fallback for rækker fra før sourceWeek-migrationen
  await prisma.$transaction([
    prisma.taskLine.deleteMany({ where: { orderId } }),
    prisma.order.delete({ where: { id: orderId } }),
    ...(o.subscriptionId != null
      ? [prisma.subscriptionWeekSkip.createMany({
          data: [{ subscriptionId: o.subscriptionId, week }],
          skipDuplicates: true,
        })]
      : []),
  ]);
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  revalidatePath(`/customers/${o.contactId}`); // kundesidens ordretabeller viser også ordren
  if (redirectTo) redirect(redirectTo);
}

/** Mandag (UTC midnat) i ugen der indeholder `d` — tombstone-nøglen. */
function mondayOfUTC(d: Date): Date {
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * 864e5);
}

function revalidateSchedule(orderId?: number) {
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

/** Calendar context-menu "Lås helt op" (locked=false) / "Lås op, fastgør til
 *  ugedag" (locked=true — the planner pins it to its weekday). */
export async function setOrderLock(orderId: number, locked: boolean): Promise<void> {
  await guardAction();
  await prisma.order.update({ where: { id: orderId }, data: { lockedFully: locked } });
  revalidateSchedule();
}

/** Calendar "Flyt til anden uge …" — shift the order ±N weeks. When `unlock`,
 *  also fully release it so the planner may re-slot it in the target week. */
export async function moveOrderWeeks(orderId: number, weeks: number, unlock = false): Promise<void> {
  await guardAction();
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { plannedAt: true, subscriptionId: true, sourceWeek: true },
  });
  if (!o) return;
  const plannedAt = new Date(o.plannedAt.getTime() + weeks * 7 * 864e5);
  // Backfill sourceWeek for abonnements-rækker fra før sourceWeek-migrationen:
  // uden den ville deleteOrders tombstone-fallback (mondayOf(plannedAt)) efter
  // en flytning ramme den FLYTTEDE uge, så natte-genereringen genopretter
  // ordren i rytme-ugen. Ugen FØR flytningen er det bedste bud på rytme-ugen.
  // @@unique([subscriptionId, sourceWeek]) kan kollidere med en anden række —
  // i så fald lader vi feltet stå tomt (fallback-adfærden er da uændret).
  let sourceWeekFix: { sourceWeek: Date } | undefined;
  if (o.subscriptionId != null && o.sourceWeek == null) {
    const candidate = mondayOfUTC(o.plannedAt);
    const clash = await prisma.order.findFirst({
      where: { subscriptionId: o.subscriptionId, sourceWeek: candidate, NOT: { id: orderId } },
      select: { id: true },
    });
    if (!clash) sourceWeekFix = { sourceWeek: candidate };
  }
  await prisma.order.update({
    where: { id: orderId },
    data: unlock ? { plannedAt, lockedFully: false, ...sourceWeekFix } : { plannedAt, ...sourceWeekFix },
  });
  revalidateSchedule();
}

/** Sidebar "Genplanlæg uge" — kør ugeplanlæggeren og PERSISTER resultatet
 *  (plannedAt + employeeId), så ordrelister/PDF/påmindelser følger med.
 *  Uden persisteringen var knappen en no-op: planen genberegnes alligevel
 *  deterministisk on-read, så revalidate alene ændrede aldrig noget. */
export async function replanWeek(weekMonday: string): Promise<void> {
  await guardAction();
  await planAndPersistWeek(weekMonday);
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect(`/calendar?week=${weekMonday}`);
}

export async function completeOrder(orderId: number, _prev: CompleteOrderState, formData: FormData): Promise<CompleteOrderState> {
  await guardAction();
  const leveringsstatus = String(formData.get("leveringsstatus") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const addressNote = String(formData.get("addressNote") ?? "").trim();
  const betaling = String(formData.get("betaling") ?? "").trim();
  const values = { leveringsstatus, betaling, comment, addressNote }; // ekkoes ved fejl — indtastningen må ikke gå tabt
  if (!leveringsstatus || !(leveringsstatus in STATUS)) return { error: "Vælg en leveringsstatus.", values };

  // backUrl kommer fra formularen — accepter KUN interne, relative stier:
  // "/..." men aldrig "//host", backslash eller kontroltegn/whitespace
  // (browsere normaliserer "/\evil.com" og striber tab/CR/LF, så begge dele
  // ville ellers kunne blive til den eksterne "//evil.com").
  const rawBack = String(formData.get("backUrl") ?? "");
  const backUrl = rawBack.startsWith("/") && !rawBack.startsWith("//") && !/[\x00-\x20\\]/.test(rawBack) ? rawBack : "/orders";

  // "Betaling og fakturering" — persist the chosen invoicing action. Only the five
  // known values are stored; anything else (or blank) means "no invoicing decision".
  const invoiceDecision = betaling && isInvoiceDecision(betaling) ? betaling : null;

  // Guard: ordren kan være slettet (fx af kontoret) mens formularen stod åben
  // på en telefon — prisma.order.update ville da kaste P2025 og give brugeren
  // Next' generiske fejlside. Returnér i stedet en venlig fejl i formularen.
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { completedAt: true, contactId: true } });
  if (!order) return { error: "Ordren findes ikke længere — den kan være slettet.", values };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: STATUS[leveringsstatus],
      comment: comment || null,
      addressNote: addressNote || null,
      // Faktisk afslutningstidspunkt — kun ved reel udførelse ("Udført"), ikke
      // ved sprunget-over/genplanlægges/anden status. Bruges af buildWeekPlan
      // (lib/queries.ts) til at rykke medarbejderens resterende opgaver samme
      // dag frem, hvis hun/han blev hurtigere færdig end planlagt. Sættes kun
      // FØRSTE gang: en genafslutning (fx for at rette en kommentar) må ikke
      // overskrive det faktiske tidspunkt, som fremrykningen regner med.
      ...(leveringsstatus === "udfoert" && !order.completedAt ? { completedAt: new Date() } : {}),
      // Only overwrite the invoicing decision when one was actually chosen — re-completing
      // an order merely to fix status/comment must not wipe a previously stored decision
      // (the radios have no default selection).
      ...(invoiceDecision ? { invoiceDecision } : {}),
    },
  });

  // Fire Dinero invoicing (dry-run unless configured). Decoupled: it never throws
  // and never blocks completion — a failure is recorded on the order (status
  // 'Failed' + dineroError) and surfaced with a "Fakturér igen" affordance.
  let invoiceFailed = false;
  if (invoiceDecision) {
    const res = await issueInvoiceForOrder(orderId);
    invoiceFailed = !res.ok;
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/daycalendar");
  revalidatePath("/calendar");
  // ?back kan pege på kundesiden — dens ordretabel skal også opdateres
  // (symmetrisk med deleteOrder), ellers viser den gammel status fra cachen.
  revalidatePath(`/customers/${order.contactId}`);
  // On invoicing failure, land on the order so the error + retry are front and centre.
  redirect(invoiceFailed ? `/orders/${orderId}` : backUrl);
}
