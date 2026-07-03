// DB access layer. Every function returns one of the view types the pages were
// built against (see lib/data.ts), so swapping a page from the mock arrays to the
// database is a one-line change with no JSX churn. All reads go through the shared
// Prisma client in lib/db.ts.
import { prisma } from "./db";
import type { Contact, Subscription, Order, TaskLine } from "./data";
import { planWeek, isoWeek, fmtTime, type Job } from "./planner";
import {
  sourceType, type CalEvent, type CalStatus, type LockState,
  type WeekDay, type Employee, type CalendarWeek, type DayProgram, type DayStop,
} from "./calendar";
import type { Prisma } from "@prisma/client";

/** The order-source display label ("Abo. #…" / "Online ordre" / …). */
function sourceLabel(type: string, subDisplayNo?: number | null): string {
  if (type === "subscription" && subDisplayNo != null) return `Abo. #${subDisplayNo}`;
  if (type === "online") return "Online ordre";
  if (type === "fixed") return "Fastprisaftale";
  return "Manuel ordre";
}

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
  const source = sourceLabel(o.sourceType, o.subscription?.displayNo);
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

/** Raw fields for the edit form (includes companyName/ean/note the view type omits). */
export async function getContactEditData(id: number) {
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return null;
  return {
    isCompany: c.isCompany,
    companyName: c.companyName ?? "",
    cvr: c.cvr ?? "",
    ean: c.ean ?? "",
    name: c.name,
    att: c.att ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    address: c.city ? `${c.street}, ${c.city}` : c.street,
    note: c.note ?? "",
  };
}

/** All contacts as lightweight picker options (id, name, one-line address). */
export async function getContactOptions() {
  const rows = await prisma.contact.findMany({ orderBy: { name: "asc" } });
  return rows.map((c) => ({ id: c.id, name: c.name, address: c.city ? `${c.street}, ${c.city}` : c.street }));
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

/** Editor data for a subscription, keyed by its display no ("Abo. nr."). */
export async function getSubscriptionEditData(displayNo: number) {
  const s = await prisma.subscription.findUnique({ where: { displayNo }, include: { tasks: true } });
  if (!s) return null;
  return {
    pk: s.id,
    displayNo: s.displayNo,
    contactId: s.contactId,
    baseInterval: s.baseInterval,
    startWeek: s.startWeek ?? "",
    fixedEmployee: s.fixedEmployee,
    deliveryAddress: s.deliveryAddress,
    tasks: [...s.tasks].sort((a, b) => a.sort - b.sort).map((t) => ({
      description: t.description, price: String(t.price), duration: String(t.durationMin),
      category: t.category, interval: t.intervalMultiplier ?? "Hver gang", nextWeek: t.startWeek ?? "",
    })),
  };
}

/** Fixed-employee options: "Ingen" + each active employee's name. */
export async function getEmployeeNames(): Promise<string[]> {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return ["Ingen", ...users.map((u) => `${u.firstName} ${u.lastName}`)];
}

// ---- Fixed-price agreements --------------------------------------------------

export type FixedPrice = {
  id: number; // displayNo ("Aftale nr.")
  pk: number;
  contactId: number;
  contactName: string;
  deliveryAddress: string;
  tasks: TaskLine[];
};

type FixedRow = Prisma.FixedPriceAgreementGetPayload<{ include: { tasks: true; contact: true } }>;
function mapFixedPrice(f: FixedRow): FixedPrice {
  return {
    id: f.displayNo,
    pk: f.id,
    contactId: f.contactId,
    contactName: f.contact.name,
    deliveryAddress: f.deliveryAddress,
    tasks: [...f.tasks].sort((a, b) => a.sort - b.sort).map(mapTask),
  };
}

export async function getFixedPrices(): Promise<FixedPrice[]> {
  const rows = await prisma.fixedPriceAgreement.findMany({
    include: { tasks: true, contact: true },
    orderBy: { displayNo: "desc" },
  });
  return rows.map(mapFixedPrice);
}

export async function getFixedPricesForContact(contactId: number): Promise<FixedPrice[]> {
  const rows = await prisma.fixedPriceAgreement.findMany({
    where: { contactId },
    include: { tasks: true, contact: true },
    orderBy: { displayNo: "desc" },
  });
  return rows.map(mapFixedPrice);
}

/** Editor data for a fixed-price agreement, keyed by its display no ("Aftale nr."). */
export async function getFixedPriceEditData(displayNo: number) {
  const f = await prisma.fixedPriceAgreement.findUnique({ where: { displayNo }, include: { tasks: true } });
  if (!f) return null;
  return {
    pk: f.id,
    displayNo: f.displayNo,
    contactId: f.contactId,
    deliveryAddress: f.deliveryAddress,
    tasks: [...f.tasks].sort((a, b) => a.sort - b.sort).map((t) => ({
      description: t.description, price: String(t.price), duration: String(t.durationMin), category: t.category,
    })),
  };
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

/** "Uge 29, mandag d. 13/7-26" — the planned delivery day, without the routed clock slot. */
function plannedLabel(d: Date): string {
  const weekdayIdx = (d.getUTCDay() + 6) % 7;
  const yy = String(d.getUTCFullYear()).slice(2);
  return `Uge ${isoWeek(ymd(d))}, ${WEEKDAYS_FULL[weekdayIdx]} d. ${d.getUTCDate()}/${d.getUTCMonth() + 1}-${yy}`;
}

export type OrderDetail = {
  id: number; status: string; comment: string; addressNote: string; lockedFully: boolean;
  deliveryAddress: string; plannedLabel: string; source: string; employee: string;
  contact: { name: string; street: string; city: string; att: string; phone: string; email: string; cvr: string };
  tasks: TaskLine[]; sumPrice: number; sumDuration: number;
};

export async function getOrderDetail(id: number): Promise<OrderDetail | null> {
  const o = await prisma.order.findUnique({
    where: { id },
    include: { tasks: true, subscription: true, employee: true, contact: true },
  });
  if (!o) return null;
  const tasks = [...o.tasks].sort((a, b) => a.sort - b.sort);
  const src = sourceLabel(o.sourceType, o.subscription?.displayNo);
  return {
    id: o.id,
    status: o.status,
    comment: o.comment ?? "",
    addressNote: o.addressNote ?? "",
    lockedFully: o.lockedFully,
    deliveryAddress: o.deliveryAddress,
    plannedLabel: plannedLabel(o.plannedAt),
    source: o.subscription ? `${src} (${o.subscription.baseInterval})` : src,
    employee: o.employee ? `${o.employee.firstName} ${o.employee.lastName}` : "Ingen",
    contact: {
      name: o.contact.name, street: o.contact.street, city: o.contact.city,
      att: o.contact.att ?? "", phone: o.contact.phone ?? "", email: o.contact.email ?? "", cvr: o.contact.cvr ?? "",
    },
    tasks: tasks.map(mapTask),
    sumPrice: tasks.reduce((a, t) => a + t.price, 0),
    sumDuration: tasks.reduce((a, t) => a + t.durationMin, 0),
  };
}

// ---- Planner ---------------------------------------------------------------

/** True if the week beginning `weekMonday` is closed by a holiday (Ferie). */
export async function isHolidayWeek(weekMonday: string): Promise<boolean> {
  const monday = new Date(`${weekMonday}T00:00:00Z`);
  const count = await prisma.holidayWeek.count({ where: { startWeek: { lte: monday }, endWeek: { gte: monday } } });
  return count > 0;
}

/** Jobs the auto-planner should route for the week beginning `weekMonday` (ISO date). */
export async function getPlannerJobs(weekMonday: string): Promise<Job[]> {
  if (await isHolidayWeek(weekMonday)) return []; // holiday week is closed
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
    source: sourceLabel(o.sourceType, o.subscription?.displayNo),
    // Hard planning constraints only — a subscription can pin fixed weekdays.
    // "Fast medarb." is "Ingen" in the demo, so no fixed-employee constraint.
    fixedWeekdays: o.subscription?.fixedWeekdays ? o.subscription.fixedWeekdays.split("").map(Number) : undefined,
    locked: o.lockedFully,
    lockedWeekday: o.lockedFully ? (o.plannedAt.getUTCDay() + 6) % 7 : undefined,
  }));
}

// ---- Calendar / day program ------------------------------------------------

const MON_SHORT = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];
const MONTHS = ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"];
const DA_DAYS = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];
const WEEKDAYS_FULL = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDrive = (min: number) => `${Math.floor(min / 60)} t ${min % 60} min`;

/** Fetch the week's orders, derive planner jobs, and route them. Shared by the
 *  week calendar and the day program so both agree on times, revenue and driving. */
async function buildWeekPlan(weekMonday: string) {
  const start = new Date(`${weekMonday}T00:00:00Z`);
  const end = new Date(start.getTime() + 7 * 864e5);
  const [orders, users] = await Promise.all([
    prisma.order.findMany({
      where: { plannedAt: { gte: start, lt: end } },
      include: { tasks: true, subscription: true, contact: true },
      orderBy: { id: "asc" },
    }),
    prisma.user.findMany({ where: { activeCalendar: true }, orderBy: { id: "asc" } }),
  ]);
  const holiday = await isHolidayWeek(weekMonday);
  const priceById = new Map<number, number>();
  const jobs: Job[] = holiday ? [] : orders.map((o) => {
    priceById.set(o.id, o.tasks.reduce((a, t) => a + t.price, 0));
    return {
      id: o.id, contactId: o.contactId, customer: o.contact.name,
      address: o.deliveryAddress, postal: postalOf(o.deliveryAddress),
      category: o.tasks[0]?.category ?? "Andet",
      durationMin: o.tasks.reduce((a, t) => a + t.durationMin, 0) || 30,
      source: sourceLabel(o.sourceType, o.subscription?.displayNo),
      fixedWeekdays: o.subscription?.fixedWeekdays ? o.subscription.fixedWeekdays.split("").map(Number) : undefined,
      locked: o.lockedFully,
      lockedWeekday: o.lockedFully ? (o.plannedAt.getUTCDay() + 6) % 7 : undefined,
    };
  });
  const plan = planWeek(jobs, weekMonday);
  const empName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  return { start, plan, priceById, users, empName };
}

/** Planned revenue (incl. VAT) for every order in a calendar month. */
async function monthRevenue(year: number, monthIdx0: number): Promise<number> {
  const from = new Date(Date.UTC(year, monthIdx0, 1));
  const to = new Date(Date.UTC(year, monthIdx0 + 1, 1));
  const orders = await prisma.order.findMany({
    where: { plannedAt: { gte: from, lt: to } },
    include: { tasks: true },
  });
  return orders.reduce((sum, o) => sum + o.tasks.reduce((a, t) => a + t.price, 0), 0);
}

export async function getCalendarWeek(weekMonday: string): Promise<CalendarWeek> {
  const { start, plan, priceById, users } = await buildWeekPlan(weekMonday);
  const year = start.getUTCFullYear();

  const dayRevenue = Array<number>(7).fill(0);
  const dayDrive = Array<number>(7).fill(0);
  for (const d of plan.days) {
    dayDrive[d.weekday] = d.driveMin;
    for (const s of d.stops) dayRevenue[d.weekday] += priceById.get(s.job.id) ?? 0;
  }

  const events: CalEvent[] = plan.days.flatMap((d) =>
    d.stops.map((s) => ({
      id: s.job.id, day: d.weekday, start: s.startMin / 60, end: s.endMin / 60,
      postal: s.job.postal, customer: s.job.customer, category: s.job.category,
      status: "afventer" as CalStatus, type: sourceType(s.job.source),
      lock: (s.job.locked ? "fastlaast" : "frigjort") as LockState, employeeId: d.employeeId,
    }))
  );

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start.getTime() + i * 864e5);
    return { label: DA_DAYS[i], date: String(dt.getUTCDate()), revenue: dayRevenue[i], driving: dayDrive[i] ? fmtDrive(dayDrive[i]) : undefined };
  });

  const monMonth = start.getUTCMonth();
  const sunMonth = new Date(start.getTime() + 6 * 864e5).getUTCMonth();
  const weekLabel = cap(MON_SHORT[monMonth]) + (monMonth !== sunMonth ? ` – ${cap(MON_SHORT[sunMonth])}` : "") + ` ${year}`;
  const weekNo = isoWeek(weekMonday);
  const week = dayRevenue.reduce((a, b) => a + b, 0);
  const month = await monthRevenue(year, monMonth);
  const employees: Employee[] = users.map((u) => ({
    id: u.id, name: `${u.firstName} ${u.lastName}`, color: u.calendarColor ?? "#a4d5ee", active: u.activeCalendar,
  }));

  return {
    weekNo, weekLabel, monday: weekMonday, employees, days, events,
    planned: { weekLabel: `Uge ${weekNo}`, week, monthLabel: MONTHS[monMonth], month },
  };
}

export async function getDayProgram(dateISO: string): Promise<DayProgram> {
  const date = new Date(`${dateISO}T00:00:00Z`);
  const weekdayIdx = (date.getUTCDay() + 6) % 7; // 0 = Monday
  const mondayISO = ymd(new Date(date.getTime() - weekdayIdx * 864e5));
  const { plan, priceById, empName } = await buildWeekPlan(mondayISO);
  const dayPlan = plan.days.find((d) => d.weekday === weekdayIdx);

  const stops: DayStop[] = (dayPlan?.stops ?? []).map((s) => ({
    from: fmtTime(s.startMin), to: fmtTime(s.endMin),
    address: s.job.address, customer: s.job.customer,
    price: priceById.get(s.job.id) ?? 0,
    employee: empName.get(dayPlan!.employeeId) ?? "Ingen",
    source: s.job.source,
  }));

  let revenueWeek = 0;
  for (const d of plan.days) for (const s of d.stops) revenueWeek += priceById.get(s.job.id) ?? 0;

  return {
    heading: `${date.getUTCDate()}. ${MON_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
    relative: `${WEEKDAYS_FULL[weekdayIdx]} (uge ${isoWeek(mondayISO)})`,
    revenueDay: stops.reduce((a, s) => a + s.price, 0),
    revenueWeek,
    revenueMonth: await monthRevenue(date.getUTCFullYear(), date.getUTCMonth()),
    driving: fmtDrive(dayPlan?.driveMin ?? 0),
    stops,
  };
}
