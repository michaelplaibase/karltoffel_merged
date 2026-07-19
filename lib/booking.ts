// ============================================================================
// Booking engine — the "auto-booking motor" Karl (the AI) drives over MCP.
//
// Two responsibilities:
//   1. findFirstAvailableSlot(...) — the earliest free workday slot for a
//      handyman, derived from the Orders already assigned to them.
//   2. createBooking(...) — materialise a manual Order + TaskLines assigned to
//      that handyman, storing the full customer/address/task detail.
//
// It reuses the same primitives the rest of the CRM uses:
//   - prisma client (lib/db)
//   - the minute-rate price↔duration conversion (Company.minutePriceOere)
//   - the category colour helper (lib/categories) used by createOrder
//   - the holiday-week guard (lib/queries.isHolidayWeek)
//
// IMPORTANT — how availability is (and is not) derived from Order data.
// The CRM does NOT store a per-order clock time. `Order.plannedAt` holds the
// delivery DATE (stored at UTC midday); the exact 08:00/09:30/… slot shown in
// the calendar is computed on-read by the route planner (lib/planner.ts), not
// persisted. So we cannot read a real "busy from 09:00 to 10:30" interval back
// out of an Order. Instead this engine models each employee's day as a CAPACITY
// bucket: sum the service minutes of every open order assigned to them on a day,
// lay new work sequentially from the start of the workday, and offer the first
// day whose remaining capacity fits the estimated duration. That is a safe,
// deterministic first-cut ("show the first free slot, book earliest") — the team
// reshuffles exact times later via the planner. Turning this into true clock-slot
// availability needs a stored start-time field on Order (see gap notes / PR).
// ============================================================================

import { prisma } from "./db";
import { categoryColor } from "./categories";
import { isHolidayWeek } from "./queries";

// Workday window for booking (task spec: 07:00–15:00). Kept local so it is
// independent of the calendar grid constants (which are 08–16 for display).
export const BOOK_WORK_START_MIN = 7 * 60; // 07:00
export const BOOK_WORK_END_MIN = 15 * 60; // 15:00
const DAY_MS = 864e5;

// Order statuses that no longer occupy the calendar (mirrors CLOSED_STATUSES in
// lib/queries.ts) — closed orders free up their capacity.
const CLOSED_STATUSES = new Set(["Afsluttet", "Udført", "Sprunget over"]);

// ---- date helpers (UTC-stable, same convention as lib/queries.ts) ----------
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** Monday 0 … Sunday 6 for an ISO date string. */
function weekdayOf(dateISO: string): number {
  return (new Date(`${dateISO}T00:00:00Z`).getUTCDay() + 6) % 7;
}
const isWorkdayDefault = (dateISO: string) => weekdayOf(dateISO) < 5; // Mon–Fri
const fmtClock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export type Slot = {
  dateISO: string;
  weekday: number; // 0 = Monday
  startMin: number; // minutes from midnight (workday-relative sequential)
  endMin: number;
  startLabel: string; // "07:00"
  endLabel: string; // "08:30"
};

// ---------------------------------------------------------------------------
// PURE core (unit-testable without a database).
// Given the existing load per day for ONE employee, return the earliest day+slot
// whose remaining workday capacity fits `durationMin`.
// ---------------------------------------------------------------------------
export function findSlotInSchedule(opts: {
  /**
   * One entry per already-booked order: which day, how many service minutes and
   * — when known — the concrete clock start (minutes from midnight, from
   * Order.startAt). Entries WITHOUT startMin are legacy date-only orders and are
   * treated as capacity reserved from the start of the workday (packed front-to-
   * back). Entries WITH startMin occupy their exact [startMin, startMin+dur]
   * interval so new work never overlaps them; gaps are filled when they fit.
   */
  bookings: { dateISO: string; durationMin: number; startMin?: number }[];
  durationMin: number;
  fromDateISO: string;
  daysToScan?: number;
  workStartMin?: number;
  workEndMin?: number;
  isWorkday?: (dateISO: string) => boolean;
  /** Optional extra day filter (e.g. holiday weeks) — return false to skip. */
  isOpen?: (dateISO: string) => boolean;
}): Slot | null {
  const {
    bookings,
    durationMin,
    fromDateISO,
    daysToScan = 60,
    workStartMin = BOOK_WORK_START_MIN,
    workEndMin = BOOK_WORK_END_MIN,
    isWorkday = isWorkdayDefault,
    isOpen,
  } = opts;

  if (!(durationMin > 0)) return null;

  // Group each day's load: fixed intervals (orders with a concrete startMin) and
  // the summed minutes of legacy date-only orders (reserved at the workday front).
  const byDay = new Map<string, { fixed: [number, number][]; floating: number }>();
  for (const b of bookings) {
    const rec = byDay.get(b.dateISO) ?? { fixed: [], floating: 0 };
    const dur = Math.max(0, b.durationMin);
    if (typeof b.startMin === "number") rec.fixed.push([b.startMin, b.startMin + dur]);
    else rec.floating += dur;
    byDay.set(b.dateISO, rec);
  }

  const mkSlot = (dateISO: string, start: number): Slot => ({
    dateISO,
    weekday: weekdayOf(dateISO),
    startMin: start,
    endMin: start + durationMin,
    startLabel: fmtClock(start),
    endLabel: fmtClock(start + durationMin),
  });

  const from = new Date(`${fromDateISO}T00:00:00Z`);
  for (let i = 0; i < daysToScan; i++) {
    const dateISO = ymd(new Date(from.getTime() + i * DAY_MS));
    if (!isWorkday(dateISO)) continue;
    if (isOpen && !isOpen(dateISO)) continue;

    const rec = byDay.get(dateISO) ?? { fixed: [], floating: 0 };
    // Build the day's occupied intervals: legacy load reserved from 07:00 +
    // every fixed booking's own interval, merged into disjoint busy blocks.
    const intervals = rec.fixed.slice();
    if (rec.floating > 0) intervals.push([workStartMin, workStartMin + rec.floating]);
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const iv of intervals) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
      else merged.push([iv[0], iv[1]]);
    }

    // Sweep from 07:00, packing into the earliest gap that fits before 15:00.
    let cursor = workStartMin;
    for (const [s, e] of merged) {
      if (s - cursor >= durationMin && cursor + durationMin <= workEndMin) return mkSlot(dateISO, cursor);
      cursor = Math.max(cursor, e);
    }
    if (cursor + durationMin <= workEndMin) return mkSlot(dateISO, cursor);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Duration estimation (the human-in-the-loop hook lives here).
// Each task line's minutes come from, in order of confidence:
//   1. an explicit durationMin on the line (authoritative)
//   2. derived from price via the company minute-rate (Company.minutePriceOere):
//      durationMin = (price / 1.25 [strip VAT]) / (kr per minute)
//   3. a 30-min fallback
// If ANY line is not explicit we mark `estimated: true` so the booking is flagged
// as needing human confirmation — the crew corrects it, and over time explicit
// durations replace the estimates.
// ---------------------------------------------------------------------------
export type TaskLineInput = { category?: string; description: string; price?: number; durationMin?: number };
export type EstimatedLine = { category: string; letter: string; color: string; description: string; price: number; durationMin: number; estimated: boolean };

export function estimateLineDurations(lines: TaskLineInput[], minuteRate: number): { lines: EstimatedLine[]; totalDurationMin: number; estimated: boolean } {
  const rate = minuteRate > 0 ? minuteRate : 8.6; // kr/min excl. VAT (matches getMinuteRate default 860 øre)
  let estimated = false;
  const out: EstimatedLine[] = lines.map((l) => {
    const category = l.category?.trim() || "Andet";
    const price = Number.isFinite(l.price) ? Math.max(0, Number(l.price)) : 0;
    let durationMin = l.durationMin;
    let lineEstimated = false;
    if (!(typeof durationMin === "number" && durationMin > 0)) {
      lineEstimated = true;
      durationMin = price > 0 ? Math.max(15, Math.round(price / 1.25 / rate)) : 30;
    }
    if (lineEstimated) estimated = true;
    return {
      category,
      letter: (category[0] ?? "A").toUpperCase(),
      color: categoryColor(category),
      description: l.description.trim(),
      price,
      durationMin,
      estimated: lineEstimated,
    };
  });
  return { lines: out, totalDurationMin: out.reduce((a, l) => a + l.durationMin, 0), estimated };
}

/** kr/min excl. VAT from Company.minutePriceOere (mirrors getMinuteRate). */
async function getMinuteRate(): Promise<number> {
  const company = await prisma.company.findFirst({ select: { minutePriceOere: true } });
  return (company?.minutePriceOere ?? 860) / 100;
}

// ---------------------------------------------------------------------------
// DB wrapper: earliest free slot for a specific handyman.
// ---------------------------------------------------------------------------
export async function findFirstAvailableSlot(input: {
  employeeId: number;
  durationMin: number;
  fromDate?: string; // ISO yyyy-mm-dd; defaults to today (UTC)
  daysToScan?: number;
}): Promise<Slot | null> {
  const fromDateISO = input.fromDate ?? ymd(new Date());
  const daysToScan = input.daysToScan ?? 60;
  const from = new Date(`${fromDateISO}T00:00:00Z`);
  const to = new Date(from.getTime() + daysToScan * DAY_MS);

  const orders = await prisma.order.findMany({
    where: {
      employeeId: input.employeeId,
      plannedAt: { gte: from, lt: to },
      status: { notIn: [...CLOSED_STATUSES] },
    },
    include: { tasks: { select: { durationMin: true } } },
  });

  const bookings = orders.map((o) => ({
    dateISO: ymd(o.plannedAt),
    durationMin: o.tasks.reduce((a, t) => a + t.durationMin, 0) || 30,
    // Concrete clock start when the order has one (UTC-stable, same convention as
    // ymd); legacy date-only orders leave startMin undefined → treated as
    // front-of-day capacity.
    startMin: o.startAt ? o.startAt.getUTCHours() * 60 + o.startAt.getUTCMinutes() : undefined,
  }));

  // Precompute holiday-closed weeks in range (a closed week offers no slots).
  const holidayCache = new Map<string, boolean>();
  const mondayISOOf = (dateISO: string) => {
    const d = new Date(`${dateISO}T00:00:00Z`);
    const wd = (d.getUTCDay() + 6) % 7;
    return ymd(new Date(d.getTime() - wd * DAY_MS));
  };
  // Pre-warm the cache for every Monday in the scan window (bounded, ~9 weeks).
  for (let i = 0; i < daysToScan; i += 7) {
    const mon = mondayISOOf(ymd(new Date(from.getTime() + i * DAY_MS)));
    if (!holidayCache.has(mon)) holidayCache.set(mon, await isHolidayWeek(mon));
  }

  return findSlotInSchedule({
    bookings,
    durationMin: input.durationMin,
    fromDateISO,
    daysToScan,
    isOpen: (dateISO) => !(holidayCache.get(mondayISOOf(dateISO)) ?? false),
  });
}

// ---------------------------------------------------------------------------
// createBooking — materialise the Order + TaskLines assigned to the handyman.
// ---------------------------------------------------------------------------
export type NewContactInput = {
  name: string;
  phone?: string;
  email?: string;
  address: string; // "street, 8660 Skanderborg" — split on last comma
};

export type CreateBookingInput = {
  contactId?: number;
  newContact?: NewContactInput;
  deliveryAddress?: string; // defaults to the contact's address
  taskLines: TaskLineInput[];
  employeeId: number;
  /** ISO yyyy-mm-dd of the chosen day. If omitted, the first available slot is used. */
  plannedDate?: string;
  comment?: string;
};

export type CreateBookingResult = {
  orderId: number;
  contactId: number;
  employeeId: number;
  employeeName: string;
  plannedDate: string;
  /** Concrete booked clock start on plannedDate ("07:00"), or null if date-only. */
  startLabel: string | null;
  /** ISO instant persisted to Order.startAt, or null. */
  startAt: string | null;
  proposedSlot: Slot | null;
  totalDurationMin: number;
  totalPrice: number;
  /** True when any task duration was estimated → needs human confirmation. */
  needsConfirmation: boolean;
  lines: EstimatedLine[];
};

/** Split "Ørnedvej 4, 8660 Skanderborg" into { street, city }. */
function splitAddress(address: string): { street: string; city: string } {
  const idx = address.lastIndexOf(",");
  if (idx < 0) return { street: address.trim(), city: "" };
  return { street: address.slice(0, idx).trim(), city: address.slice(idx + 1).trim() };
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  if (!input.taskLines?.length) throw new Error("createBooking: mindst én opgavelinje kræves");
  if (!input.employeeId) throw new Error("createBooking: employeeId kræves");

  const employee = await prisma.user.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new Error("createBooking: medarbejderen blev ikke fundet");

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new Error("createBooking: ingen virksomhed konfigureret");

  // Resolve / create the contact.
  let contactId = input.contactId ?? null;
  let deliveryAddress = input.deliveryAddress ?? "";
  if (!contactId) {
    if (!input.newContact) throw new Error("createBooking: contactId eller newContact kræves");
    const nc = input.newContact;
    const { street, city } = splitAddress(nc.address);
    const created = await prisma.contact.create({
      data: {
        companyId: company.id,
        name: nc.name,
        phone: nc.phone ?? null,
        email: nc.email ? nc.email.toLowerCase() : null,
        street,
        city,
      },
      select: { id: true, street: true, city: true },
    });
    contactId = created.id;
    if (!deliveryAddress) deliveryAddress = created.city ? `${created.street}, ${created.city}` : created.street;
  } else {
    const c = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!c) throw new Error("createBooking: kunden blev ikke fundet");
    if (!deliveryAddress) deliveryAddress = c.city ? `${c.street}, ${c.city}` : c.street;
  }

  // Estimate durations (human-in-the-loop hook).
  const minuteRate = await getMinuteRate();
  const est = estimateLineDurations(input.taskLines, minuteRate);

  // Choose the day + concrete clock start. When the caller pins a day we pack
  // within THAT day only (daysToScan:1); otherwise we take the first free slot.
  const durationForSlot = est.totalDurationMin || 30;
  const slot = await findFirstAvailableSlot({
    employeeId: input.employeeId,
    durationMin: durationForSlot,
    fromDate: input.plannedDate,
    daysToScan: input.plannedDate ? 1 : 60,
  });
  const plannedDate = input.plannedDate ?? slot?.dateISO ?? ymd(new Date());
  // Store the delivery DATE at UTC midday like createOrder (backwards-compat) …
  const plannedAt = new Date(`${plannedDate}T10:00:00Z`);
  // … and the precise booked clock start (UTC-stable) when we have one on the day.
  const startAt =
    slot && slot.dateISO === plannedDate ? new Date(`${plannedDate}T${fmtClock(slot.startMin)}:00Z`) : null;

  // Flag estimated bookings in the comment so the crew sees it needs confirming.
  const confirmNote = est.estimated
    ? "[AUTO-BOOKET af Karl — varighed estimeret, BEKRÆFT tid/pris]"
    : "[AUTO-BOOKET af Karl]";
  const comment = [confirmNote, input.comment?.trim()].filter(Boolean).join("\n");

  const order = await prisma.order.create({
    data: {
      contactId: contactId!,
      deliveryAddress,
      plannedAt,
      startAt,
      sourceType: "manual",
      employeeId: input.employeeId,
      status: "Afventer levering",
      comment,
      tasks: {
        create: est.lines.map((l, i) => ({
          category: l.category,
          letter: l.letter,
          color: l.color,
          description: l.description,
          price: l.price,
          durationMin: l.durationMin,
          sort: i,
        })),
      },
    },
    select: { id: true },
  });

  return {
    orderId: order.id,
    contactId: contactId!,
    employeeId: input.employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    plannedDate,
    startLabel: startAt ? fmtClock(startAt.getUTCHours() * 60 + startAt.getUTCMinutes()) : null,
    startAt: startAt ? startAt.toISOString() : null,
    proposedSlot: input.plannedDate ? null : slot,
    totalDurationMin: est.totalDurationMin,
    totalPrice: est.lines.reduce((a, l) => a + l.price, 0),
    needsConfirmation: est.estimated,
    lines: est.lines,
  };
}
