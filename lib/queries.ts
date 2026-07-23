// DB access layer. Every function returns one of the view types the pages were
// built against (see lib/data.ts), so swapping a page from the mock arrays to the
// database is a one-line change with no JSX churn. All reads go through the shared
// Prisma client in lib/db.ts.
import { prisma } from "./db";
import type { Contact, Subscription, Order, TaskLine } from "./data";
import { planWeek, isoWeek, fmtTime, type Job, type Employee as PlannerEmployee } from "./planner";
import { weekLabel } from "./weeks";
import { coordFor } from "./geo";
import {
  sourceType, type CalEvent, type CalStatus, type LockState,
  type WeekDay, type Employee, type CalendarWeek, type DayProgram, type DayStop,
  type UnplannedJob, type MonthChip, type MonthDay, type MonthWeek,
  type MonthCell, type MonthMatrixRow, type CalendarMonth,
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
    pending: s.pending,
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
    weekMonday: mondayISOOf(o.plannedAt),
    subscriptionNo: o.subscription?.displayNo ?? null,
  };
}

// ---- free-text search (single `q` param, like the portal's list search) -----

/** Contact-field OR clause reused by every list that joins a contact. */
function contactOr(q: string): Prisma.ContactWhereInput {
  return { OR: [
    { name: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } },
    { street: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { att: { contains: q, mode: "insensitive" } },
  ] };
}
/** Parse "#123, #124" style id lists (used by subscription→orders deep links). */
function parseIdList(q: string): number[] | null {
  if (!q.includes("#")) return null;
  const ids = q.split(/[\s,]+/).filter((t) => t.startsWith("#")).map((t) => Number(t.slice(1))).filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : null;
}

// ---- date helpers (UTC-stable so display doesn't drift with server TZ) ------

/** Order dates are stored at UTC midday; format the calendar date from UTC parts. */
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** Monday (ISO yyyy-mm-dd, UTC) of the week containing `d` — for "Vis ordre i kalender". */
function mondayISOOf(d: Date): string {
  const wd = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return ymd(new Date(midnight - wd * 864e5));
}
/** Statusser der lukker en ordre — den kan ikke længere være "forfalden".
 *  completeOrder skriver "Udført"/"Sprunget over" (app/actions/orders.ts);
 *  "Skal genplanlægges"/"Anden status" er stadig handlingskrævende og
 *  forbliver derfor flagget. */
const CLOSED_STATUSES = new Set(["Afsluttet", "Udført", "Sprunget over"]);
function isOverdue(plannedAt: Date, status: string): boolean {
  if (CLOSED_STATUSES.has(status)) return false;
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
export async function getContacts(q?: string): Promise<Contact[]> {
  const has = { OR: [{ orders: { some: {} } }, { subscriptions: { some: {} } }] };
  const term = q?.trim();
  const num = term && /^\d+$/.test(term) ? Number(term) : null;
  const search: Prisma.ContactWhereInput | undefined = term
    ? { OR: [...contactOr(term).OR!, ...(num ? [{ id: num }] : [])] }
    : undefined;
  const rows = await prisma.contact.findMany({
    where: search ? { AND: [has, search] } : has,
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

/** Per-contact invoicing overrides for the contact-settings page. */
export async function getContactSettings(id: number) {
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return null;
  return {
    id: c.id, name: c.name,
    skipDeliveryAddressOnInvoice: c.skipDeliveryAddressOnInvoice,
    showDeliveryNameOnInvoice: c.showDeliveryNameOnInvoice,
    skipInvoiceOverSms: c.skipInvoiceOverSms,
    invoiceChoicePreselect: c.invoiceChoicePreselect,
  };
}

/** All contacts as lightweight picker options (id, name, one-line address). */
export async function getContactOptions() {
  const rows = await prisma.contact.findMany({ orderBy: { name: "asc" } });
  return rows.map((c) => ({ id: c.id, name: c.name, address: c.city ? `${c.street}, ${c.city}` : c.street }));
}

// ---- Subscriptions ---------------------------------------------------------

export async function getSubscriptions(q?: string): Promise<Subscription[]> {
  const term = q?.trim();
  const num = term && /^\d+$/.test(term) ? Number(term) : null;
  const search: Prisma.SubscriptionWhereInput | undefined = term ? { OR: [
    ...(num ? [{ displayNo: num }] : []),
    { deliveryAddress: { contains: term, mode: "insensitive" } }, { nextWeek: { contains: term, mode: "insensitive" } }, { baseInterval: { contains: term, mode: "insensitive" } },
    { contact: contactOr(term) },
    { tasks: { some: { description: { contains: term, mode: "insensitive" } } } },
  ] } : undefined;
  // Aktive + AFVENTENDE (pending) vises; kun stoppede (active=false, pending=false) skjules.
  const visible: Prisma.SubscriptionWhereInput = { OR: [{ active: true }, { pending: true }] };
  const rows = await prisma.subscription.findMany({
    where: search ? { AND: [visible, search] } : visible,
    include: { tasks: true },
    orderBy: { displayNo: "desc" },
  });
  return rows.map(mapSubscription);
}

export async function getSubscriptionsForContact(contactId: number): Promise<Subscription[]> {
  const rows = await prisma.subscription.findMany({
    where: { contactId, OR: [{ active: true }, { pending: true }] },
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
    pending: s.pending,
    tasks: [...s.tasks].sort((a, b) => a.sort - b.sort).map((t) => ({
      description: t.description, price: String(t.price), duration: String(t.durationMin),
      category: t.category, interval: t.intervalMultiplier ?? "Hver gang", nextWeek: t.startWeek ?? "",
      // "Måneder på pause" — strengform ('1'/'0'/ISO) så formularen kan prefille
      // og submitte felterne uændret (round-trip: gem sletter+genopretter linjerne).
      pauseActive: t.pauseActive ? "1" : "0", pauseStart: t.pauseStart ?? "",
      pauseEnd: t.pauseEnd ?? "", pauseYearly: t.pauseYearly ? "1" : "0",
    })),
  };
}

/** Minutpris (kr/min EKSKL. moms) til varighedsberegning på opgavelinjer.
 *  Gemmes i øre på Company.minutePriceOere (default 860 => 8,6 kr/min). */
export async function getMinuteRate(): Promise<number> {
  const company = await prisma.company.findFirst({ select: { minutePriceOere: true } });
  return (company?.minutePriceOere ?? 860) / 100;
}

/** Fixed-employee options: "Ingen" + each active employee's name. */
export async function getEmployeeNames(): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { id: "asc" } });
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

export async function getFixedPrices(q?: string): Promise<FixedPrice[]> {
  const term = q?.trim();
  const num = term && /^\d+$/.test(term) ? Number(term) : null;
  const where: Prisma.FixedPriceAgreementWhereInput | undefined = term ? { OR: [
    ...(num ? [{ displayNo: num }] : []),
    { deliveryAddress: { contains: term, mode: "insensitive" } },
    { contact: contactOr(term) },
    { tasks: { some: { description: { contains: term, mode: "insensitive" } } } },
  ] } : undefined;
  const rows = await prisma.fixedPriceAgreement.findMany({
    where,
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

export async function getOrders(q?: string): Promise<Order[]> {
  const term = q?.trim();
  const idList = term ? parseIdList(term) : null;
  const num = term && /^\d+$/.test(term) ? Number(term) : null;
  const where: Prisma.OrderWhereInput | undefined = idList
    ? { id: { in: idList } }
    : term ? { OR: [
        ...(num ? [{ id: num }] : []),
        { deliveryAddress: { contains: term, mode: "insensitive" } }, { status: { contains: term, mode: "insensitive" } },
        { contact: contactOr(term) },
        { tasks: { some: { description: { contains: term, mode: "insensitive" } } } },
      ] } : undefined;
  const rows = await prisma.order.findMany({ where, include: orderInclude, orderBy: { id: "desc" } });
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
  invoiceDecision: string; dineroInvoiceStatus: string; dineroInvoiceNumber: number | null; dineroError: string;
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
    invoiceDecision: o.invoiceDecision ?? "",
    dineroInvoiceStatus: o.dineroInvoiceStatus ?? "",
    dineroInvoiceNumber: o.dineroInvoiceNumber,
    dineroError: o.dineroError ?? "",
  };
}

// ---- Planner ---------------------------------------------------------------

// ---- Catalogs: discount codes + standard tasks -----------------------------

export async function getDiscountCodes() {
  const rows = await prisma.discountCode.findMany({ orderBy: { id: "desc" } });
  return rows.map((d) => ({ id: d.id, code: d.code, percent: d.percent, expiresAt: d.expiresAt ? ymd(d.expiresAt) : "" }));
}

export async function getStandardTasks(q?: string, includeInactive = false) {
  const term = q?.trim();
  const where: Prisma.StandardTaskWhereInput = {
    ...(includeInactive ? {} : { active: true }),
    ...(term ? { OR: [{ description: { contains: term, mode: "insensitive" } }, { category: { contains: term, mode: "insensitive" } }, { letter: { contains: term, mode: "insensitive" } }] } : {}),
  };
  const rows = await prisma.standardTask.findMany({ where, orderBy: [{ category: "asc" }, { description: "asc" }] });
  return rows.map((t) => ({ id: t.id, category: t.category, description: t.description, letter: t.letter ?? "", presence: t.customerPresenceRequired, isSystem: t.isSystem, active: t.active }));
}

/** Planned holidays (Ferier) with display labels for the /holidays list. */
export async function getHolidays() {
  const rows = await prisma.holidayWeek.findMany({ orderBy: { startWeek: "asc" } });
  return rows.map((h) => {
    const startISO = ymd(h.startWeek), endISO = ymd(h.endWeek);
    return {
      id: h.id,
      period: startISO === endISO ? weekLabel(startISO) : `${weekLabel(startISO)} – ${weekLabel(endISO)}`,
      editableUntil: weekLabel(ymd(new Date(h.startWeek.getTime() - 7 * 864e5))),
    };
  });
}

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

/** Map active users to the planner's Employee shape (standard 08–16 Mon–Fri day). */
function plannerEmployeesFrom(
  users: { id: number; firstName: string; lastName: string; homeAddress: string | null }[]
): PlannerEmployee[] {
  return users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    home: coordFor(u.homeAddress ?? ""),
    workStartMin: 8 * 60,
    workEndMin: 16 * 60,
    flexMin: 60,
    workdays: [0, 1, 2, 3, 4],
  }));
}

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
  const metaById = new Map<number, { subNo: number | null; status: string; phone: string | null; tasks: TaskLine[]; comment: string; addressNote: string }>();
  // Ferielukket uge: der PLANLÆGGES intet, men allerede-materialiserede ordrer
  // må aldrig blive usynlige — de vises som "Ikke planlagt (ferielukket)".
  const jobs: Job[] = orders.map((o) => {
    priceById.set(o.id, o.tasks.reduce((a, t) => a + t.price, 0));
    metaById.set(o.id, {
      subNo: o.subscription?.displayNo ?? null, status: o.status,
      phone: o.contact.phone ?? null,
      tasks: [...o.tasks].sort((a, b) => a.sort - b.sort).map(mapTask),
      comment: o.comment ?? "", addressNote: o.addressNote ?? "",
    });
    return {
      id: o.id, contactId: o.contactId, customer: o.contact.name,
      address: o.deliveryAddress, postal: postalOf(o.deliveryAddress),
      category: o.tasks[0]?.category ?? "Andet",
      durationMin: o.tasks.reduce((a, t) => a + t.durationMin, 0) || 30,
      source: sourceLabel(o.sourceType, o.subscription?.displayNo),
      fixedWeekdays: o.subscription?.fixedWeekdays ? o.subscription.fixedWeekdays.split("").map(Number) : undefined,
      fixedEmployeeId: o.employeeId ?? undefined,
      locked: o.lockedFully,
      lockedWeekday: o.lockedFully ? (o.plannedAt.getUTCDay() + 6) % 7 : undefined,
    };
  });
  // Only jobs pinned to an ACTIVE employee go through the router — everything
  // else lands in "unplanned" (they must never be dumped on the first lane).
  const plannerEmps = plannerEmployeesFrom(users);
  const activeIds = new Set(users.map((u) => u.id));
  const placeable = holiday ? [] : jobs.filter((j) => j.fixedEmployeeId != null && activeIds.has(j.fixedEmployeeId));
  const unassigned = holiday ? [] : jobs.filter((j) => j.fixedEmployeeId == null || !activeIds.has(j.fixedEmployeeId));
  const plan = planWeek(placeable, weekMonday, plannerEmps);
  const unplanned: { job: Job; reason: "unassigned" | "overflow" | "holiday" }[] = holiday
    ? jobs.map((job) => ({ job, reason: "holiday" as const }))
    : [
        ...plan.unplanned.map((job) => ({ job, reason: "overflow" as const })),
        ...unassigned.map((job) => ({ job, reason: "unassigned" as const })),
      ];
  const empName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  return { start, plan, priceById, metaById, users, empName, holiday, unplanned };
}

/** Map a stored order status to the calendar's status class. */
function calStatusOf(status: string): CalStatus {
  if (status === "Afsluttet" || status === "Udført") return "afsluttet";
  if (status.startsWith("Mislykk")) return "mislykket";
  return "afventer";
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
  const { start, plan, priceById, metaById, users, unplanned: rawUnplanned } = await buildWeekPlan(weekMonday);
  const year = start.getUTCFullYear();

  const dayRevenue = Array<number>(7).fill(0);
  const dayDrive = Array<number>(7).fill(0);
  for (const d of plan.days) {
    dayDrive[d.weekday] = d.driveMin;
    for (const s of d.stops) dayRevenue[d.weekday] += priceById.get(s.job.id) ?? 0;
  }

  const events: CalEvent[] = plan.days.flatMap((d) =>
    d.stops.map((s) => {
      const meta = metaById.get(s.job.id);
      return {
        id: s.job.id, day: d.weekday, start: s.startMin / 60, end: s.endMin / 60,
        postal: s.job.postal, customer: s.job.customer, category: s.job.category,
        status: calStatusOf(meta?.status ?? "Afventer levering"), type: sourceType(s.job.source),
        lock: (s.job.locked ? "fastlaast" : "frigjort") as LockState, employeeId: d.employeeId,
        contactId: s.job.contactId, subscriptionNo: meta?.subNo ?? null,
        phone: meta?.phone ?? null,
      };
    })
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

  const unplanned: UnplannedJob[] = rawUnplanned.map(({ job, reason }) => {
    const meta = metaById.get(job.id);
    return {
      id: job.id, postal: job.postal, customer: job.customer, category: job.category,
      status: calStatusOf(meta?.status ?? "Afventer levering"), contactId: job.contactId,
      subscriptionNo: meta?.subNo ?? null, phone: meta?.phone ?? null, reason,
    };
  });

  return {
    weekNo, weekLabel, monday: weekMonday, employees, days, events, unplanned,
    planned: { weekLabel: `Uge ${weekNo}`, week, monthLabel: MONTHS[monMonth], month },
  };
}

export async function getDayProgram(dateISO: string): Promise<DayProgram> {
  const date = new Date(`${dateISO}T00:00:00Z`);
  const weekdayIdx = (date.getUTCDay() + 6) % 7; // 0 = Monday
  const mondayISO = ymd(new Date(date.getTime() - weekdayIdx * 864e5));
  const { plan, priceById, metaById, empName } = await buildWeekPlan(mondayISO);
  // Aggregate across ALL employees working this weekday (one DayPlan per employee).
  const dayPlans = plan.days.filter((d) => d.weekday === weekdayIdx);

  const stops: DayStop[] = dayPlans
    .flatMap((dp) => dp.stops.map((s) => ({ dp, s })))
    .sort((a, b) => a.s.startMin - b.s.startMin)
    .map(({ dp, s }) => {
      const meta = metaById.get(s.job.id);
      return {
        from: fmtTime(s.startMin), to: fmtTime(s.endMin),
        address: s.job.address, customer: s.job.customer,
        price: priceById.get(s.job.id) ?? 0,
        employee: empName.get(dp.employeeId) ?? "Ingen",
        source: s.job.source,
        orderId: s.job.id, contactId: s.job.contactId,
        subscriptionNo: meta?.subNo ?? null, phone: meta?.phone ?? null, status: meta?.status ?? "Afventer levering",
        tasks: (meta?.tasks ?? []).map((t) => ({ category: t.category, letter: t.letter, description: t.description, price: t.price, durationMin: t.durationMin })),
        comment: meta?.comment ?? "", addressNote: meta?.addressNote ?? "",
      };
    });

  let revenueWeek = 0;
  for (const d of plan.days) for (const s of d.stops) revenueWeek += priceById.get(s.job.id) ?? 0;

  return {
    heading: `${date.getUTCDate()}. ${MON_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
    relative: `${WEEKDAYS_FULL[weekdayIdx]} (uge ${isoWeek(mondayISO)})`,
    dateISO, weekMonday: mondayISO,
    prevISO: ymd(new Date(date.getTime() - 864e5)),
    nextISO: ymd(new Date(date.getTime() + 864e5)),
    revenueDay: stops.reduce((a, s) => a + s.price, 0),
    revenueWeek,
    revenueMonth: await monthRevenue(date.getUTCFullYear(), date.getUTCMonth()),
    driving: fmtDrive(dayPlans.reduce((a, d) => a + d.driveMin, 0)),
    stops,
  };
}

// ---- Month view --------------------------------------------------------------

/** Month overview for the calendar's month mode: a date grid (variant A) and a
 *  week × employee matrix (variant B), both derived from the same week plans so
 *  they agree with the week/day views. `monthParam` is "YYYY-MM". */
export async function getCalendarMonth(monthParam: string): Promise<CalendarMonth> {
  let year: number;
  let monthIdx: number;
  const m = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    year = Number(m[1]);
    monthIdx = Number(m[2]) - 1;
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    monthIdx = now.getUTCMonth();
  }

  const first = new Date(Date.UTC(year, monthIdx, 1));
  const last = new Date(Date.UTC(year, monthIdx + 1, 0)); // last day of month (UTC midnight)
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 864e5); // Monday of week containing the 1st
  const todayISO = ymd(new Date());

  const weeks: MonthWeek[] = [];
  const weekPlans: Awaited<ReturnType<typeof buildWeekPlan>>[] = [];
  for (let wm = gridStart; wm.getTime() <= last.getTime(); wm = new Date(wm.getTime() + 7 * 864e5)) {
    const mondayISO = ymd(wm);
    const wp = await buildWeekPlan(mondayISO);
    weekPlans.push(wp);
    const days: MonthDay[] = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(wm.getTime() + i * 864e5);
      const dateISO = ymd(dt);
      const chips: MonthChip[] = wp.plan.days
        .filter((dp) => dp.weekday === i)
        .flatMap((dp) => dp.stops.map((s) => {
          const meta = wp.metaById.get(s.job.id);
          return {
            id: s.job.id, weekday: i, employeeId: dp.employeeId,
            label: s.job.customer || s.job.postal,
            postal: s.job.postal, category: s.job.category,
            status: calStatusOf(meta?.status ?? "Afventer levering"),
            contactId: s.job.contactId,
          };
        }));
      return {
        dateISO, dateNum: dt.getUTCDate(), weekday: i,
        inMonth: dt.getUTCMonth() === monthIdx, isToday: dateISO === todayISO, chips,
      };
    });
    weeks.push({ weekNo: isoWeek(mondayISO), monday: mondayISO, holiday: wp.holiday, days });
  }

  // Active users: every buildWeekPlan fetched the same set — reuse the first.
  const users = weekPlans[0]!.users;
  const employees: Employee[] = users.map((u) => ({
    id: u.id, name: `${u.firstName} ${u.lastName}`, color: u.calendarColor ?? "#a4d5ee", active: u.activeCalendar,
  }));

  // Variant B: week × employee matrix (counts + planned revenue).
  const zero = (): MonthCell => ({ count: 0, revenue: 0 });
  const add = (a: MonthCell, b: MonthCell): MonthCell => ({ count: a.count + b.count, revenue: a.revenue + b.revenue });
  const weekNos = weeks.map((w) => w.weekNo);
  const matrix: MonthMatrixRow[] = users.map((u) => {
    const cells = weekPlans.map((wp) => {
      const cell = zero();
      for (const dp of wp.plan.days) {
        if (dp.employeeId !== u.id) continue;
        for (const s of dp.stops) {
          cell.count += 1;
          cell.revenue += wp.priceById.get(s.job.id) ?? 0;
        }
      }
      return cell;
    });
    return { employeeId: u.id, cells, total: cells.reduce(add, zero()) };
  });
  const colTotals: MonthCell[] = weekNos.map((_, k) => matrix.reduce((acc, r) => add(acc, r.cells[k]), zero()));
  const grandTotal = colTotals.reduce(add, zero());

  const mp = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    year, monthIdx, monthLabel: `${MONTHS[monthIdx]} ${year}`,
    monthParam: mp(first),
    prevMonth: mp(new Date(Date.UTC(year, monthIdx - 1, 1))),
    nextMonth: mp(new Date(Date.UTC(year, monthIdx + 1, 1))),
    employees, weeks, weekNos, matrix, colTotals, grandTotal,
  };
}
