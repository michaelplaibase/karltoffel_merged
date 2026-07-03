// DB access layer. Every function returns one of the view types the pages were
// built against (see lib/data.ts), so swapping a page from the mock arrays to the
// database is a one-line change with no JSX churn. All reads go through the shared
// Prisma client in lib/db.ts.
import { prisma } from "./db";
import type { Contact, Subscription, Order, TaskLine } from "./data";
import type { Job } from "./planner";
import type { Prisma } from "@prisma/client";

// ---- row → view-type mappers ----------------------------------------------

type TaskRow = Prisma.TaskLineGetPayload<object>;
function mapTask(t: TaskRow): TaskLine {
  return {
    category: t.category,
    letter: t.letter,
    description: t.description,
    price: t.price,
    durationMin: t.durationMin,
    interval: t.intervalMultiplier ?? undefined,
    nextWeek: t.startWeek ?? undefined,
    fromSubscription: t.fromSubscription,
    isStandardTask: t.isStandardTask,
  };
}

type ContactRow = Prisma.ContactGetPayload<{ include: { _count: { select: { subscriptions: true } } } }>;
function mapContact(c: ContactRow): Contact {
  return {
    id: c.id,
    name: c.name,
    isCompany: c.isCompany,
    cvr: c.cvr ?? undefined,
    street: c.street,
    city: c.city,
    att: c.att ?? undefined,
    phone: c.phone ?? "",
    email: c.email ?? "",
    revenueYtd: c.revenueYtd,
    avgYearlyFromSubs: c.avgYearlyFromSubs,
    subscriptionCount: c._count.subscriptions,
  };
}

type SubRow = Prisma.SubscriptionGetPayload<{ include: { tasks: true } }>;
function mapSubscription(s: SubRow): Subscription {
  return {
    id: s.displayNo,
    pk: s.id,
    contactId: s.contactId,
    deliveryAddress: s.deliveryAddress,
    tasks: [...s.tasks].sort((a, b) => a.sort - b.sort).map(mapTask),
    interval: s.baseInterval,
    fixedEmployee: s.fixedEmployee,
    nextWeek: s.nextWeek ?? "",
  };
}

type OrderRow = Prisma.OrderGetPayload<{ include: { tasks: true; subscription: true; employee: true } }>;
function mapOrder(o: OrderRow): Order {
  const source =
    o.sourceType === "subscription" && o.subscription ? `Abo. #${o.subscription.displayNo}`
    : o.sourceType === "online" ? "Online ordre"
    : o.sourceType === "fixed" ? "Fastprisaftale"
    : "Manuel ordre";
  const employee = o.employee ? `${o.employee.firstName} ${o.employee.lastName}` : "Ingen";
  return {
    id: o.id,
    contactId: o.contactId,
    deliveryAddress: o.deliveryAddress,
    deliveryDate: ymd(o.plannedAt),
    overdue: isOverdue(o.plannedAt, o.status),
    tasks: [...o.tasks].sort((a, b) => a.sort - b.sort).map(mapTask),
    employee,
    status: o.status,
    source,
  };
}

// ---- date helpers (UTC-stable so display doesn't drift with server TZ) ------

/** Order dates are stored at UTC midday; format the calendar date from UTC parts. */
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function isOverdue(plannedAt: Date, status: string): boolean {
  if (status === "Afsluttet") return false;
  const today = new Date();
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return plannedAt.getTime() < startOfToday;
}
function postalOf(address: string): string {
  const parts = address.split(",");
  return (parts.length > 1 ? parts[parts.length - 1] : address).trim();
}

// ---- Contacts --------------------------------------------------------------

/** Customers = contacts with ≥1 order or subscription (per the portal's rule). */
export async function getContacts(): Promise<Contact[]> {
  const rows = await prisma.contact.findMany({
    where: { OR: [{ orders: { some: {} } }, { subscriptions: { some: {} } }] },
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { id: "desc" },
  });
  return rows.map(mapContact);
}

export async function getContactById(id: number): Promise<Contact | null> {
  const c = await prisma.contact.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true } } },
  });
  return c ? mapContact(c) : null;
}

// ---- Subscriptions ---------------------------------------------------------

export async function getSubscriptions(): Promise<Subscription[]> {
  const rows = await prisma.subscription.findMany({
    where: { active: true },
    include: { tasks: true },
    orderBy: { displayNo: "desc" },
  });
  return rows.map(mapSubscription);
}

export async function getSubscriptionsForContact(contactId: number): Promise<Subscription[]> {
  const rows = await prisma.subscription.findMany({
    where: { contactId, active: true },
    include: { tasks: true },
    orderBy: { displayNo: "desc" },
  });
  return rows.map(mapSubscription);
}

// ---- Orders ----------------------------------------------------------------

const orderInclude = { tasks: true, subscription: true, employee: true } as const;

export async function getOrders(): Promise<Order[]> {
  const rows = await prisma.order.findMany({ include: orderInclude, orderBy: { id: "desc" } });
  return rows.map(mapOrder);
}

export async function getOrdersForContact(contactId: number): Promise<Order[]> {
  const rows = await prisma.order.findMany({ where: { contactId }, include: orderInclude, orderBy: { id: "desc" } });
  return rows.map(mapOrder);
}

// ---- Planner ---------------------------------------------------------------

/** Jobs the auto-planner should route for the week beginning `weekMonday` (ISO date). */
export async function getPlannerJobs(weekMonday: string): Promise<Job[]> {
  const start = new Date(`${weekMonday}T00:00:00Z`);
  const end = new Date(start.getTime() + 7 * 864e5);
  const rows = await prisma.order.findMany({
    where: { plannedAt: { gte: start, lt: end } },
    include: { tasks: true, subscription: true, contact: true },
    orderBy: { id: "asc" },
  });
  return rows.map((o) => ({
    id: o.id,
    contactId: o.contactId,
    customer: o.contact.name,
    address: o.deliveryAddress,
    postal: postalOf(o.deliveryAddress),
    category: o.tasks[0]?.category ?? "Andet",
    durationMin: o.tasks.reduce((a, t) => a + t.durationMin, 0) || 30,
    source:
      o.sourceType === "subscription" && o.subscription ? `Abo. #${o.subscription.displayNo}`
      : o.sourceType === "online" ? "Online ordre"
      : "Manuel ordre",
    // Hard planning constraints only — a subscription can pin fixed weekdays.
    // "Fast medarb." is "Ingen" in the demo, so no fixed-employee constraint.
    fixedWeekdays: o.subscription?.fixedWeekdays ? o.subscription.fixedWeekdays.split("").map(Number) : undefined,
  }));
}
