"use server";

// Server actions for orders: create a manual order, and the "Afslut ordre"
// (complete order) flow.
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { categoryColor } from "@/lib/categories";
import { isInvoiceDecision, issueInvoiceForOrder } from "@/lib/dinero";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type OrderCreateState = { error?: string };

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
  const contactId = Number(formData.get("contactId"));
  if (!contactId) return { error: "Vælg en kunde." };
  const lines = readTaskLines(formData);
  if (!lines.length) return { error: "Tilføj mindst én opgave." };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  const week = String(formData.get("week") ?? "");
  const plannedAt = week ? new Date(`${week}T10:00:00Z`) : new Date();
  const user = await prisma.user.findFirst({ where: { active: true } });

  const order = await prisma.order.create({
    data: {
      contactId,
      deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
      plannedAt,
      sourceType: "manual",
      employeeId: user?.id ?? null,
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

export type CompleteOrderState = { error?: string };

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
    select: { subscriptionId: true, sourceWeek: true, plannedAt: true },
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
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { plannedAt: true } });
  if (!o) return;
  const plannedAt = new Date(o.plannedAt.getTime() + weeks * 7 * 864e5);
  await prisma.order.update({
    where: { id: orderId },
    data: unlock ? { plannedAt, lockedFully: false } : { plannedAt },
  });
  revalidateSchedule();
}

/** Sidebar "Genplanlæg uge" — re-run the (deterministic, on-read) week planner
 *  and refresh the calendar for the shown week. */
export async function replanWeek(weekMonday: string): Promise<void> {
  await guardAction();
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect(`/calendar?week=${weekMonday}`);
}

export async function completeOrder(orderId: number, _prev: CompleteOrderState, formData: FormData): Promise<CompleteOrderState> {
  await guardAction();
  const leveringsstatus = String(formData.get("leveringsstatus") ?? "");
  if (!leveringsstatus || !(leveringsstatus in STATUS)) return { error: "Vælg en leveringsstatus." };

  const comment = String(formData.get("comment") ?? "").trim();
  const addressNote = String(formData.get("addressNote") ?? "").trim();
  const backUrl = String(formData.get("backUrl") ?? "/orders") || "/orders";

  // "Betaling og fakturering" — persist the chosen invoicing action. Only the five
  // known values are stored; anything else (or blank) means "no invoicing decision".
  const betaling = String(formData.get("betaling") ?? "").trim();
  const invoiceDecision = betaling && isInvoiceDecision(betaling) ? betaling : null;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: STATUS[leveringsstatus], comment: comment || null, addressNote: addressNote || null, invoiceDecision },
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
  // On invoicing failure, land on the order so the error + retry are front and centre.
  redirect(invoiceFailed ? `/orders/${orderId}` : backUrl);
}
