// DB access layer. Every function returns one of the view types the pages were
// built against (see lib/data.ts), so swapping a page from the mock arrays to the
// database is a one-line change with no JSX churn. All reads go through the shared
// Prisma client in lib/db.ts.
import { prisma } from "./db";
import type { Contact, Subscription, Order, TaskLine } from "./data";
import { planWeek, isoWeek, fmtTime, stopInstant, type Job, type Employee as PlannerEmployee, type DayPlan } from "./planner";
import { weekLabel } from "./weeks";
import { todayCphISO, weekMondayToday } from "./calendar";
import { subscriptionOutlookProblem } from "./recurrence";
import { coordFor } from "./geo";
import {
  sourceType, type CalEvent, type CalStatus, type LockState,
  type WeekDay, type Employee, type CalendarWeek, type DayProgram, type DayStop,
  type DayUnplannedStop, type UnplannedJob, type MonthChip, type MonthDay, type MonthWeek,
  type MonthCell, type MonthMatrixRow, type CalendarMonth,
} from "./calendar";
import type { Prisma } from "@prisma/client";
import { effectiveCalendarTaskDuration } from "./calendar-duration";

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
function mapSubscription(s: SubRow, generationWarning: string | null = null): Subscription {
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
    generationWarning,
  };
}

/** STILLE-NUL-VAGT (uge 35-hændelsen): pr. abonnement — står et AKTIVT
 *  abonnement uden kommende ordrer, selvom rytmen siger, det burde have nogen?
 *  Genereringen fejler stille (returnerer 0), så uden denne vagt kan et
 *  abonnement forsvinde fra kalenderen i ugevis, mens alt ser intakt ud. */
async function generationWarningsByPk(rows: SubRow[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const candidates = rows.filter((r) => r.active && !r.pending);
  if (!candidates.length) return out;
  const from = new Date(`${weekMondayToday()}T00:00:00Z`);
  const ids = candidates.map((r) => r.id);
  const [future, total] = await Promise.all([
    prisma.order.groupBy({ by: ["subscriptionId"], where: { subscriptionId: { in: ids }, plannedAt: { gte: from } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["subscriptionId"], where: { subscriptionId: { in: ids } }, _count: { _all: true } }),
  ]);
  const futureBySub = new Map(future.map((g) => [g.subscriptionId, g._count._all]));
  const totalBySub = new Map(total.map((g) => [g.subscriptionId, g._count._all]));
  for (const r of candidates) {
    const problem = subscriptionOutlookProblem(r, futureBySub.get(r.id) ?? 0, totalBySub.get(r.id) ?? 0);
    if (problem) out.set(r.id, problem);
  }
  return out;
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

/** Contact-field OR clause reused by every list that joins a contact.
 *  Telefonsøgning matcher også på RENE CIFRE ("12 34 56 78" og "+45 12345678"
 *  finder "12345678") — lead-konverterede kunder gemmes normaliseret, mens
 *  håndindtastede numre kan have mellemrum/+45 (scripts/normalize-phones.ts
 *  normaliserer eksisterende rækker). */
function contactOr(q: string): Prisma.ContactWhereInput {
  const digits = q.replace(/\D/g, "");
  const phoneVariants: Prisma.ContactWhereInput[] = digits.length >= 6
    ? [
        { phone: { contains: digits } },
        ...(digits.startsWith("45") && digits.length === 10 ? [{ phone: { contains: digits.slice(2) } }] : []),
      ]
    : [];
  return { OR: [
    { name: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } },
    ...phoneVariants,
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
  // "I dag" i DANSK tid (plannedAt er UTC-dagsforankret) — serverens UTC-dato
  // er en dag bagud mellem midnat og kl. 01/02 og gav falske markeringer.
  return plannedAt.getTime() < Date.parse(`${todayCphISO()}T00:00:00Z`);
}
function postalOf(address: string): string {
  const parts = address.split(",");
  return (parts.length > 1 ? parts[parts.length - 1] : address).trim();
}

// ---- Contacts --------------------------------------------------------------

/** Customers = contacts with ≥1 order or subscription (per the portal's rule).
 *  SØGNING går dog på ALLE kontakter — en nyoprettet kontakt uden ordre/abo
 *  var ellers umulig at genfinde i UI'et (listen OG søgningen filtrerede den
 *  fra, og der findes ingen anden kontaktliste). */
export async function getContacts(q?: string): Promise<Contact[]> {
  const has = { OR: [{ orders: { some: {} } }, { subscriptions: { some: {} } }] };
  const term = q?.trim();
  const num = term && /^\d+$/.test(term) ? Number(term) : null;
  const search: Prisma.ContactWhereInput | undefined = term
    ? { OR: [...contactOr(term).OR!, ...(num ? [{ id: num }] : [])] }
    : undefined;
  const rows = await prisma.contact.findMany({
    where: search ?? has,
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
    invoiceFrequency: c.invoiceFrequency,
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
  const warnings = await generationWarningsByPk(rows);
  return rows.map((r) => mapSubscription(r, warnings.get(r.id) ?? null));
}

export async function getSubscriptionsForContact(contactId: number): Promise<Subscription[]> {
  const rows = await prisma.subscription.findMany({
    where: { contactId, OR: [{ active: true }, { pending: true }] },
    include: { tasks: true },
    orderBy: { displayNo: "desc" },
  });
  const warnings = await generationWarningsByPk(rows);
  return rows.map((r) => mapSubscription(r, warnings.get(r.id) ?? null));
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

/** Employee picker options (id + display name) for the manual order form —
 *  unlike getEmployeeNames (subscriptions' free-text "Ingen"/name list), a
 *  manual order stores a real employeeId FK, so the picker needs ids. */
export async function getEmployeeOptions(): Promise<{ id: number; name: string }[]> {
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  return users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
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

/** Parse et søgeterm som dato: "2026-07-13", "13/7-2026", "13/7-26", "13-07-2026". */
function parseSearchDate(term: string): Date | null {
  let y: number, m: number, d: number;
  const isoM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(term);
  const dkM = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/.exec(term);
  if (isoM) [y, m, d] = [Number(isoM[1]), Number(isoM[2]), Number(isoM[3])];
  else if (dkM) [d, m, y] = [Number(dkM[1]), Number(dkM[2]), Number(dkM[3]) < 100 ? 2000 + Number(dkM[3]) : Number(dkM[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** Fælles where-bygger for ordre-søgning: ordrenr/#-lister, kundenr, dato
 *  (leveringsdatoens UTC-døgn), adresse, status, kundefelter og opgavetekst —
 *  søgefeltets placeholder lover dato og kundenr, så de skal reelt virke. */
function orderSearchWhere(term: string | undefined): Prisma.OrderWhereInput | undefined {
  if (!term) return undefined;
  const idList = parseIdList(term);
  if (idList) return { id: { in: idList } };
  const num = /^\d+$/.test(term) ? Number(term) : null;
  const day = parseSearchDate(term);
  return { OR: [
    ...(num ? [{ id: num }, { contactId: num }] : []),
    ...(day ? [{ plannedAt: { gte: day, lt: new Date(day.getTime() + 864e5) } }] : []),
    { deliveryAddress: { contains: term, mode: "insensitive" as const } }, { status: { contains: term, mode: "insensitive" as const } },
    { contact: contactOr(term) },
    { tasks: { some: { description: { contains: term, mode: "insensitive" as const } } } },
  ] };
}

export async function getOrders(q?: string): Promise<Order[]> {
  const where = orderSearchWhere(q?.trim() || undefined);
  const rows = await prisma.order.findMany({ where, include: orderInclude, orderBy: { id: "desc" } });
  return rows.map(mapOrder);
}

/** Ordrelisten med RIGTIG server-side paginering: før hentede siden samtlige
 *  ordrer (plus hele kundekartoteket) pr. visning, og pagineringen var kun
 *  kosmetisk. Returnerer sidens ordrer + netop de kontakter siden viser. */
export async function getOrdersPage(q: string | undefined, pageNum = 1, pageSize = 25): Promise<{ orders: Order[]; contacts: Contact[]; page: number; totalPages: number }> {
  const where = orderSearchWhere(q?.trim() || undefined);
  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, pageNum), totalPages);
  const rows = await prisma.order.findMany({
    where, include: orderInclude, orderBy: { id: "desc" },
    skip: (page - 1) * pageSize, take: pageSize,
  });
  const contactIds = [...new Set(rows.map((r) => r.contactId))];
  const contactRows = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
    include: { _count: { select: { subscriptions: true } } },
  });
  return { orders: rows.map(mapOrder), contacts: contactRows.map(mapContact), page, totalPages };
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
    durationMin: o.tasks.reduce((a, t) => a + effectiveCalendarTaskDuration(t.durationMin), 0),
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
    // active:true OGSÅ: en deaktiveret bruger med gammelt activeCalendar-flag
    // må aldrig optræde som kalender-lane (users-actions holder flagene i sync
    // fremadrettet; dette er det defensive filter for eksisterende data).
    prisma.user.findMany({ where: { activeCalendar: true, active: true }, orderBy: { id: "asc" } }),
  ]);
  const holiday = await isHolidayWeek(weekMonday);
  const priceById = new Map<number, number>();
  const completedAtById = new Map<number, Date | null>();
  // Ordrens PERSISTEREDE ugedag (plannedAt) — bruges til at placere ikke-
  // planlagte ordrer på deres dag i dagsprogrammet (de har intet klokkeslæt).
  const weekdayById = new Map<number, number>();
  const metaById = new Map<number, { subNo: number | null; status: string; phone: string | null; tasks: TaskLine[]; comment: string; addressNote: string }>();
  // Ferielukket uge: der PLANLÆGGES intet, men allerede-materialiserede ordrer
  // må aldrig blive usynlige — de vises som "Ikke planlagt (ferielukket)".
  const jobs: Job[] = orders.map((o) => {
    priceById.set(o.id, o.tasks.reduce((a, t) => a + t.price, 0));
    completedAtById.set(o.id, o.completedAt ?? null);
    weekdayById.set(o.id, (o.plannedAt.getUTCDay() + 6) % 7);
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
      durationMin: o.tasks.reduce((a, t) => a + effectiveCalendarTaskDuration(t.durationMin), 0),
      source: sourceLabel(o.sourceType, o.subscription?.displayNo),
      fixedWeekdays: o.subscription?.fixedWeekdays ? o.subscription.fixedWeekdays.split("").map(Number) : undefined,
      fixedEmployeeId: o.employeeId ?? undefined,
      // UDFØRTE/afgjorte ordrer (alt andet end "Afventer levering") er sket i
      // virkeligheden — de pinnes til deres persisterede dag ligesom låste,
      // så dagsbevidst planlægning aldrig "flytter fortiden".
      locked: o.lockedFully || o.status !== "Afventer levering",
      lockedWeekday: o.lockedFully || o.status !== "Afventer levering" ? (o.plannedAt.getUTCDay() + 6) % 7 : undefined,
    };
  });
  // Only jobs pinned to an ACTIVE employee go through the router — everything
  // else lands in "unplanned" (they must never be dumped on the first lane).
  const plannerEmps = plannerEmployeesFrom(users);
  const activeIds = new Set(users.map((u) => u.id));
  const placeable = holiday ? [] : jobs.filter((j) => j.fixedEmployeeId != null && activeIds.has(j.fixedEmployeeId));
  // "Ikke tildelt" og "tildelt en kollega uden for kalenderen" er to forskellige
  // problemer for kontoret — vis dem med hver sin årsag i stedet for én pulje.
  const unassigned = holiday ? [] : jobs.filter((j) => j.fixedEmployeeId == null);
  const inactiveEmp = holiday ? [] : jobs.filter((j) => j.fixedEmployeeId != null && !activeIds.has(j.fixedEmployeeId));
  // Dagsbevidsthed (uge 35-hændelsen: en ordre født onsdag blev lagt på den
  // passerede mandag): i indeværende uge planlægges NYE placeringer kun fra
  // og med i dag. Udførte/låste ordrer beholder deres dag (pass 1).
  const todayIdx = weekdayIdxIfThisWeek(weekMonday);
  const plan = planWeek(placeable, weekMonday, plannerEmps, { fromWeekday: todayIdx ?? 0 });
  // Fremryk resten af dagens stops for hver medarbejder, der afsluttede en
  // opgave hurtigere end planlagt — men KUN for dagens ugedag (i går/i morgen
  // giver "hurtigere end planlagt" ingen mening at fremrykke visuelt for).
  if (todayIdx != null) reflowEarlyCompletions(plan.days.filter((d) => d.weekday === todayIdx), completedAtById);
  // Ærlige årsager: efter overarbejds-fallbacken er "overflow" reserveret til
  // ordrer uden nogen mulig dag (fx uge slut / låst uden match); faste ugedage
  // uden en tilbageværende arbejdsdag får deres egen forklaring.
  const noRemainingFixedDay = (job: Job) =>
    job.fixedWeekdays != null && !job.fixedWeekdays.some((w) => w >= (todayIdx ?? 0) && w <= 4);
  const unplanned: { job: Job; reason: "unassigned" | "inactive_employee" | "overflow" | "holiday" | "fixed_weekday_unavailable" }[] = holiday
    ? jobs.map((job) => ({ job, reason: "holiday" as const }))
    : [
        ...plan.unplanned.map((job) => ({ job, reason: noRemainingFixedDay(job) ? ("fixed_weekday_unavailable" as const) : ("overflow" as const) })),
        ...unassigned.map((job) => ({ job, reason: "unassigned" as const })),
        ...inactiveEmp.map((job) => ({ job, reason: "inactive_employee" as const })),
      ];
  const empName = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  // TRIPWIRE — kalender-invarianten håndhæves ved HVER beregning: hver ordre i
  // ugen skal ende i præcis én af {planlagte stops, ikke planlagt}. Skrider det
  // (en fremtidig regression), logges en fejl, der er synlig i produktions-
  // overvågningen — visningen fortsætter uændret, men bruddet er ALDRIG tavst.
  const placedIds = new Set(plan.days.flatMap((d) => d.stops.map((s) => s.job.id)));
  const unplannedIds = new Set(unplanned.map((u) => u.job.id));
  const invisible = jobs.filter((j) => !placedIds.has(j.id) && !unplannedIds.has(j.id));
  const doubled = jobs.filter((j) => placedIds.has(j.id) && unplannedIds.has(j.id));
  if (invisible.length || doubled.length) {
    console.error(`[kalender-invariant] uge ${weekMonday}: ${invisible.length} ordre(r) USYNLIGE [${invisible.map((j) => j.id).join(", ")}], ${doubled.length} vist dobbelt [${doubled.map((j) => j.id).join(", ")}]`);
  }
  return { start, plan, priceById, metaById, weekdayById, users, empName, holiday, unplanned };
}

/**
 * Kør ugeplanlæggeren med PRÆCIS samme pipeline som kalenderen (buildWeekPlan)
 * og persister det beregnede resultat på ordren (plannedAt = dag + starttid,
 * employeeId = rutet medarbejder), så ordrelister/PDF/påmindelser viser det
 * samme som kalenderen i stedet for genereringens "mandag 10:00"-placeholder.
 * Deterministisk og idempotent: planlæggeren ignorerer gemte tidspunkter og
 * genberegner altid fra bunden (se buildWeekPlan).
 */
export async function planAndPersistWeek(weekMonday: string) {
  const wp = await buildWeekPlan(weekMonday);
  const updates = wp.plan.days.flatMap((d) =>
    d.stops.map((s) =>
      prisma.order.update({
        where: { id: s.job.id },
        data: { plannedAt: stopInstant(weekMonday, d.weekday, s.startMin), employeeId: d.employeeId },
      })
    )
  );
  if (updates.length) await prisma.$transaction(updates);
  return wp;
}

/** Map a stored order status to the calendar's status class. Afslut-flowet
 *  skriver "Udført"/"Sprunget over"/"Skal genplanlægges"/"Anden status"
 *  (app/actions/orders.ts) — de handlingskrævende må IKKE ligne "Afventer". */
function calStatusOf(status: string): CalStatus {
  if (status === "Afsluttet" || status === "Udført") return "afsluttet";
  if (status === "Skal genplanlægges" || status.startsWith("Mislykk")) return "mislykket";
  if (status === "Sprunget over" || status === "Anden status") return "ikke_afsluttet";
  return "afventer";
}

const CPH_TZ = "Europe/Copenhagen";
/** Kalenderdato (Europe/Copenhagen) for et tidsstempel som yyyy-mm-dd. */
function cphDateISO(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CPH_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** Minutter siden midnat (Europe/Copenhagen vægur-tid) for et tidsstempel. */
function minutesOfDayCph(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: CPH_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const parts = fmt.formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/** Er "i dag" (Europe/Copenhagen) i den viste uge? Returnerer dagens
 *  ugedag-indeks (0=man) hvis ja, ellers null — bruges til at afgrænse
 *  reflowEarlyCompletions til KUN dagens kolonne. */
function weekdayIdxIfThisWeek(weekMonday: string): number | null {
  const monday = new Date(`${weekMonday}T00:00:00Z`);
  const todayISO = todayCphISO();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 864e5);
    if (ymd(d) === todayISO) return i;
  }
  return null;
}

/**
 * Rykker resten af en medarbejders dag frem, når en opgave afsluttes hurtigere
 * end planlagt (mødereferat 2026-08-03: "systemet skal automatisk kunne rykke
 * opgaver frem i kalenderen, hvis en medarbejder bliver hurtigere færdig end
 * planlagt"). Ren visningsjustering — planlæggeren gemmer INGEN tidspunkter i
 * databasen (de genberegnes altid on-read, se buildWeekPlan), så dette er blot
 * endnu et lag i samme beregning: for stops i dag, sorteret kronologisk, akkumuleres
 * en "drift" (sparede minutter) fra hver allerede-afsluttet opgave og trækkes fra
 * de efterfølgende, endnu ikke afsluttede stops' start/sluttid. Kun samme
 * medarbejder/dag påvirkes; forsinkelser (afsluttet SENERE end planlagt) rykker
 * IKKE — kun tidligere afslutning fremrykker (som eksplicit efterspurgt).
 */
function reflowEarlyCompletions(days: DayPlan[], completedAtById: Map<number, Date | null>): void {
  const todayISO = todayCphISO();
  for (const day of days) {
    const stops = [...day.stops].sort((a, b) => a.startMin - b.startMin);
    let drift = 0;
    for (const s of stops) {
      if (drift > 0) {
        s.startMin = Math.max(0, s.startMin - drift);
        s.endMin = Math.max(s.startMin, s.endMin - drift);
      }
      const completedAt = completedAtById.get(s.job.id);
      if (!completedAt) continue;
      // Kun afslutninger fra I DAG må fremrykke — et completedAt fra en anden
      // dag (fx en ordre afsluttet i går og siden genplanlagt til i dag) ville
      // ellers give meningsløse klokkeslæt for resten af dagen.
      if (cphDateISO(completedAt) !== todayISO) continue;
      const actualEndMin = minutesOfDayCph(completedAt);
      const savedMin = s.endMin - actualEndMin;
      if (savedMin > 0) {
        drift += savedMin;
        s.endMin = actualEndMin;
      }
    }
  }
}


/** Planned revenue (incl. VAT) for every order in a calendar month. With
 *  `employeeId` sat afgrænses til den medarbejders ordrer — samme viewer-regel
 *  som resten af kalenderen, så dag/uge/måned-tallene taler samme sprog. */
async function monthRevenue(year: number, monthIdx0: number, employeeId?: number): Promise<number> {
  const from = new Date(Date.UTC(year, monthIdx0, 1));
  const to = new Date(Date.UTC(year, monthIdx0 + 1, 1));
  const orders = await prisma.order.findMany({
    where: { plannedAt: { gte: from, lt: to }, ...(employeeId != null ? { employeeId } : {}) },
    include: { tasks: true },
  });
  return orders.reduce((sum, o) => sum + o.tasks.reduce((a, t) => a + t.price, 0), 0);
}

export async function getCalendarWeek(weekMonday: string, viewer?: { id: number; isAdmin: boolean }): Promise<CalendarWeek> {
  const { start, plan, priceById, metaById, users, unplanned: rawUnplanned } = await buildWeekPlan(weekMonday);
  const year = start.getUTCFullYear();

  // ALLE for admin (teamoverblik), men kun viewer selv for en almindelig
  // medarbejder — samme regel som getDayProgram (Michael, 2026-08-10: en
  // medarbejder skal kun se sine EGNE opgaver, ikke kollegers).
  const visibleDays = plan.days.filter((d) => !viewer || viewer.isAdmin || d.employeeId === viewer.id);
  const visibleUsers = viewer && !viewer.isAdmin ? users.filter((u) => u.id === viewer.id) : users;

  const dayRevenue = Array<number>(7).fill(0);
  const dayDrive = Array<number>(7).fill(0);
  for (const d of visibleDays) {
    // SUM over medarbejdere — én DayPlan pr. (medarbejder, ugedag), så en ren
    // tildeling ville kun vise den sidste medarbejders kørsel for dagen.
    dayDrive[d.weekday] += d.driveMin;
    for (const s of d.stops) dayRevenue[d.weekday] += priceById.get(s.job.id) ?? 0;
  }

  const events: CalEvent[] = visibleDays.flatMap((d) =>
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
  const sunday = new Date(start.getTime() + 6 * 864e5);
  const sunMonth = sunday.getUTCMonth();
  // Årsskifte-uge (fx 28/12–3/1): begge år skal med — "Dec. 2026 – Jan. 2027",
  // ikke "Dec. – Jan. 2026".
  const weekLabel = year !== sunday.getUTCFullYear()
    ? `${cap(MON_SHORT[monMonth])} ${year} – ${cap(MON_SHORT[sunMonth])} ${sunday.getUTCFullYear()}`
    : cap(MON_SHORT[monMonth]) + (monMonth !== sunMonth ? ` – ${cap(MON_SHORT[sunMonth])}` : "") + ` ${year}`;
  const weekNo = isoWeek(weekMonday);
  const week = dayRevenue.reduce((a, b) => a + b, 0);
  const month = await monthRevenue(year, monMonth, viewer && !viewer.isAdmin ? viewer.id : undefined);
  const employees: Employee[] = visibleUsers.map((u) => ({
    id: u.id, name: `${u.firstName} ${u.lastName}`, color: u.calendarColor ?? "#a4d5ee", active: u.activeCalendar,
  }));

  // Admin ser teamets fulde restance-overblik; en almindelig medarbejder skal
  // ikke se ANDRES kunde-/adressedata — men skal se sine EGNE ikke-planlagte
  // ordrer (ellers modsiger ugevisningen dagsprogrammet, som viser dem).
  const unplannedVisible = !viewer || viewer.isAdmin
    ? rawUnplanned
    : rawUnplanned.filter(({ job }) => job.fixedEmployeeId === viewer.id);
  const unplanned: UnplannedJob[] = unplannedVisible.map(({ job, reason }) => {
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

/** Dansk visningstekst for hvorfor en ordre ikke kunne planlægges på sin dag. */
const DAY_UNPLANNED_REASON: Record<string, string> = {
  unassigned: "Ikke tildelt en kollega",
  inactive_employee: "Tildelt kollega er ikke aktiv i kalenderen",
  overflow: "Ingen mulig dag tilbage i ugen",
  fixed_weekday_unavailable: "Fast ugedag er ikke en tilbageværende arbejdsdag",
  holiday: "Ferielukket uge",
};

export async function getDayProgram(dateISO: string, viewer?: { id: number; isAdmin: boolean }): Promise<DayProgram> {
  const date = new Date(`${dateISO}T00:00:00Z`);
  const weekdayIdx = (date.getUTCDay() + 6) % 7; // 0 = Monday
  const mondayISO = ymd(new Date(date.getTime() - weekdayIdx * 864e5));
  const { plan, priceById, metaById, empName, unplanned: weekUnplanned, weekdayById } = await buildWeekPlan(mondayISO);
  // Aggregate across employees working this weekday — ALLE for admin (teamoverblik),
  // men kun viewer selv for en almindelig medarbejder (Michael, 2026-08-10: en
  // medarbejder skal kun se sine EGNE opgaver, ikke kollegers). Admin/udeladt
  // viewer bevarer den hidtidige adfærd (fx daycalendar-PDF-rapporten kalder uden
  // viewer, og skal stadig vise hele dagen).
  const dayPlans = plan.days.filter((d) => d.weekday === weekdayIdx && (!viewer || viewer.isAdmin || d.employeeId === viewer.id));

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

  // Dagens ordrer som planlæggeren IKKE kunne placere (ingen kollega, kollega
  // uden for kalenderen, overløb eller ferielukket). De hører til dagen via
  // deres persisterede plannedAt og må aldrig være usynlige i dagsprogrammet.
  // Admin (og viewer-løse kald som PDF-rapporten) ser alle; en almindelig
  // medarbejder ser kun dem, der er tildelt hende/ham selv.
  const unplanned: DayUnplannedStop[] = weekUnplanned
    .filter(({ job }) => weekdayById.get(job.id) === weekdayIdx)
    .filter(({ job }) => !viewer || viewer.isAdmin || job.fixedEmployeeId === viewer.id)
    .map(({ job, reason }) => {
      const meta = metaById.get(job.id);
      return {
        address: job.address, customer: job.customer,
        price: priceById.get(job.id) ?? 0,
        employee: (job.fixedEmployeeId != null ? empName.get(job.fixedEmployeeId) : undefined) ?? "Ingen",
        source: job.source,
        orderId: job.id, contactId: job.contactId,
        subscriptionNo: meta?.subNo ?? null, phone: meta?.phone ?? null, status: meta?.status ?? "Afventer levering",
        tasks: (meta?.tasks ?? []).map((t) => ({ category: t.category, letter: t.letter, description: t.description, price: t.price, durationMin: t.durationMin })),
        comment: meta?.comment ?? "", addressNote: meta?.addressNote ?? "",
        reason: DAY_UNPLANNED_REASON[reason] ?? "Ukendt årsag",
      };
    });

  // Uge-/månedstal følger samme viewer-regel som dagens stops — før talte
  // ugetallet HELE teamet, selv når dagen kun viste medarbejderens egne
  // ordrer (dag og uge stemte ikke overens med ugekalenderen).
  const visibleWeekDays = plan.days.filter((d) => !viewer || viewer.isAdmin || d.employeeId === viewer.id);
  let revenueWeek = 0;
  for (const d of visibleWeekDays) for (const s of d.stops) revenueWeek += priceById.get(s.job.id) ?? 0;

  return {
    heading: `${date.getUTCDate()}. ${MON_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
    relative: `${WEEKDAYS_FULL[weekdayIdx]} (uge ${isoWeek(mondayISO)})`,
    dateISO, weekMonday: mondayISO,
    prevISO: ymd(new Date(date.getTime() - 864e5)),
    nextISO: ymd(new Date(date.getTime() + 864e5)),
    revenueDay: stops.reduce((a, s) => a + s.price, 0),
    revenueWeek,
    revenueMonth: await monthRevenue(date.getUTCFullYear(), date.getUTCMonth(), viewer && !viewer.isAdmin ? viewer.id : undefined),
    driving: fmtDrive(dayPlans.reduce((a, d) => a + d.driveMin, 0)),
    stops,
    unplanned,
  };
}

// ---- Month view --------------------------------------------------------------

/** Month overview for the calendar's month mode: a date grid (variant A) and a
 *  week × employee matrix (variant B), both derived from the same week plans so
 *  they agree with the week/day views. `monthParam` is "YYYY-MM". */
export async function getCalendarMonth(monthParam: string, viewer?: { id: number; isAdmin: boolean }): Promise<CalendarMonth> {
  let year: number;
  let monthIdx: number;
  const m = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    year = Number(m[1]);
    monthIdx = Number(m[2]) - 1;
  } else {
    // Fallback: aktuell måned i Europe/Copenhagen (ikke UTC — undgå forkert
    // måned ved månedsskifte om natten dansk tid).
    const [y, m] = todayCphISO().split("-").map(Number);
    year = y;
    monthIdx = m - 1;
  }

  const first = new Date(Date.UTC(year, monthIdx, 1));
  const last = new Date(Date.UTC(year, monthIdx + 1, 0)); // last day of month (UTC midnight)
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 864e5); // Monday of week containing the 1st
  const todayISO = todayCphISO();

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
        .filter((dp) => dp.weekday === i && (!viewer || viewer.isAdmin || dp.employeeId === viewer.id))
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
      // Ikke-planlagte ordrer vises på deres persisterede ugedag — måneds-
      // visningen må ikke skjule ordrer, som uge- og dagsvisningen viser.
      // Samme viewer-regel som getDayProgram: admin ser alle, medarbejder egne.
      chips.push(...wp.unplanned
        .filter(({ job }) => wp.weekdayById.get(job.id) === i && (!viewer || viewer.isAdmin || job.fixedEmployeeId === viewer.id))
        .map(({ job, reason }) => ({
          id: job.id, weekday: i, employeeId: job.fixedEmployeeId ?? 0,
          label: job.customer || job.postal,
          postal: job.postal, category: job.category,
          status: calStatusOf(wp.metaById.get(job.id)?.status ?? "Afventer levering"),
          contactId: job.contactId,
          unplanned: true, reason,
        })));
      return {
        dateISO, dateNum: dt.getUTCDate(), weekday: i,
        inMonth: dt.getUTCMonth() === monthIdx, isToday: dateISO === todayISO, chips,
      };
    });
    weeks.push({ weekNo: isoWeek(mondayISO), monday: mondayISO, holiday: wp.holiday, days });
  }

  // Active users: every buildWeekPlan fetched the same set — reuse the first.
  // Samme viewer-regel som getCalendarWeek/getDayProgram: en almindelig
  // medarbejder ser kun sig selv, admin ser hele teamet.
  const allUsers = weekPlans[0]!.users;
  const users = viewer && !viewer.isAdmin ? allUsers.filter((u) => u.id === viewer.id) : allUsers;
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
