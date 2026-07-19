// ============================================================================
// Karl's MCP tool implementations. Thin, typed functions the JSON-RPC route
// (app/api/mcp/route.ts) exposes as MCP tools. They reuse the existing CRM libs
// (booking engine, queries, reports-data, email) — no business logic is
// duplicated here beyond assembling Karl-friendly summaries.
// ============================================================================

import { prisma } from "./db";
import { findFirstAvailableSlot, createBooking, type Slot, type CreateBookingInput } from "./booking";
import { getContacts, getOrdersForContact } from "./queries";
import { sendEmail, senderForUser } from "./email";

const DAY_MS = 864e5;
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function mondayISOOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  return ymd(new Date(d.getTime() - wd * DAY_MS));
}
const startOfUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// ---- list_availability -----------------------------------------------------
export async function listAvailability(args: { employeeId?: number; durationMin?: number; fromDate?: string }) {
  const durationMin = args.durationMin && args.durationMin > 0 ? args.durationMin : 60;
  const fromDate = args.fromDate;

  const employees = args.employeeId
    ? await prisma.user.findMany({ where: { id: args.employeeId } })
    : await prisma.user.findMany({ where: { active: true, activeCalendar: true }, orderBy: { id: "asc" } });
  if (!employees.length) return { durationMin, slots: [], note: "Ingen aktive medarbejdere fundet." };

  const slots = await Promise.all(
    employees.map(async (e) => {
      const slot = await findFirstAvailableSlot({ employeeId: e.id, durationMin, fromDate });
      return {
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        firstAvailable: slot
          ? { date: slot.dateISO, from: slot.startLabel, to: slot.endLabel }
          : null,
      };
    })
  );
  // Earliest overall for convenience.
  const withSlot = slots.filter((s) => s.firstAvailable).sort((a, b) => a.firstAvailable!.date.localeCompare(b.firstAvailable!.date));
  return { durationMin, earliest: withSlot[0] ?? null, slots };
}

// ---- create_booking --------------------------------------------------------
export async function createBookingTool(args: CreateBookingInput) {
  const result = await createBooking(args);
  const slotTxt = result.proposedSlot
    ? ` — foreslået slot ${result.proposedSlot.dateISO} ${result.proposedSlot.startLabel}–${result.proposedSlot.endLabel}`
    : result.startLabel
      ? ` kl. ${result.startLabel}`
      : "";
  return {
    ...result,
    summary:
      `Ordre #${result.orderId} oprettet til ${result.employeeName} d. ${result.plannedDate}${slotTxt}. ` +
      `Varighed ${result.totalDurationMin} min, pris ${result.totalPrice} kr. ` +
      (result.needsConfirmation ? "⚠️ Varighed estimeret — bekræft tid/pris." : "Varighed angivet af kalder."),
  };
}

// ---- get_customer ----------------------------------------------------------
export async function getCustomer(args: { query: string }) {
  const q = (args.query ?? "").trim();
  if (!q) return { matches: [], note: "Angiv navn, telefon eller e-mail i `query`." };
  const contacts = await getContacts(q);
  const top = contacts.slice(0, 5);
  const matches = await Promise.all(
    top.map(async (c) => {
      const orders = await getOrdersForContact(c.id);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.city ? `${c.street}, ${c.city}` : c.street,
        isCompany: c.isCompany,
        subscriptionCount: c.subscriptionCount,
        revenueYtd: c.revenueYtd,
        orderCount: orders.length,
        recentOrders: orders.slice(0, 5).map((o) => ({
          id: o.id,
          date: o.deliveryDate,
          status: o.status,
          source: o.source,
          address: o.deliveryAddress,
          tasks: o.tasks.map((t) => t.description),
        })),
      };
    })
  );
  return { count: contacts.length, matches };
}

// ---- send_confirmation -----------------------------------------------------
// Sends a booking confirmation to the customer AS the assigned handyman.
// Identity is resolved by senderForUser (lib/email.ts): when KARL_SENDER_DOMAIN
// is configured the mail goes out from `<username>@<domain>` (verified in
// Resend) with the handyman's name; otherwise it falls back to the company
// EMAIL_FROM address stamped with the handyman's name + reply-to = their e-mail.
export async function sendConfirmation(args: { orderId: number }) {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: { contact: true, employee: true, tasks: true },
  });
  if (!order) return { ok: false, error: `Ordre #${args.orderId} findes ikke.` };
  if (!order.contact.email) return { ok: false, error: "Kunden har ingen e-mailadresse — kan ikke sende bekræftelse." };

  const handyman = order.employee ? `${order.employee.firstName} ${order.employee.lastName}` : "Karltoffel";
  // Concrete booked clock time when the order has one; otherwise date only.
  const timeLabel = order.startAt
    ? ` kl. ${String(order.startAt.getUTCHours()).padStart(2, "0")}:${String(order.startAt.getUTCMinutes()).padStart(2, "0")}`
    : "";
  const dateLabel = ymd(order.plannedAt);
  const lines = order.tasks
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((t) => `• ${t.description} (${t.durationMin} min, ${t.price} kr)`);
  const total = order.tasks.reduce((a, t) => a + t.price, 0);
  const text = [
    `Hej ${order.contact.name},`,
    ``,
    `Tak for din bestilling. Vi har booket følgende besøg:`,
    ``,
    `Dato: ${dateLabel}${timeLabel}`,
    `Adresse: ${order.deliveryAddress}`,
    ``,
    `Opgaver:`,
    ...lines,
    ``,
    `Samlet pris: ${total} kr (inkl. moms).`,
    ``,
    `Din håndværker er ${handyman}. Skriv eller ring hvis noget skal ændres.`,
    ``,
    `Venlig hilsen`,
    handyman,
    `Karltoffel`,
  ].join("\n");

  // Send AS the assigned handyman where possible (per-user verified sender via
  // KARL_SENDER_DOMAIN), else company address + handyman name/reply-to.
  const identity = order.employee
    ? senderForUser(order.employee)
    : { from: undefined, senderName: "Karltoffel", replyTo: undefined };
  const res = await sendEmail({
    to: order.contact.email,
    subject: `Bekræftelse på dit besøg d. ${dateLabel}`,
    text,
    from: identity.from,
    senderName: identity.senderName,
    replyTo: identity.replyTo,
  });
  return {
    ok: res.ok,
    simulated: res.simulated ?? false,
    to: order.contact.email,
    from: res.from ?? identity.senderName,
    error: res.error,
    note: process.env.KARL_SENDER_DOMAIN
      ? "Sendt fra håndværkerens egen verificerede afsender (KARL_SENDER_DOMAIN)."
      : "KARL_SENDER_DOMAIN ikke sat: sendt fra virksomhedens EMAIL_FROM med håndværkerens navn som afsender + reply-to = håndværkerens e-mail.",
  };
}

// ---- list_leads ------------------------------------------------------------
type LeadPayload = { kundetype?: string | null; services?: { navn?: string }[]; estimat?: { md?: number } };
function parsePayload(raw: string | null): LeadPayload | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as LeadPayload; } catch { return null; }
}

export async function listLeads(args: { status?: string; limit?: number }) {
  const status = args.status?.trim();
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
  const leads = await prisma.lead.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return {
    count: leads.length,
    leads: leads.map((l) => {
      const p = parsePayload(l.payload);
      return {
        id: l.id,
        status: l.status,
        name: l.name,
        phone: l.phone,
        email: l.email,
        address: l.address,
        source: l.source,
        createdAt: l.createdAt.toISOString(),
        kundetype: p?.kundetype ?? null,
        estimatMd: p?.estimat?.md ?? null,
        services: (p?.services ?? []).map((s) => s.navn).filter(Boolean),
      };
    }),
  };
}

// ---- service_stats ---------------------------------------------------------
// Most/least chosen services, derived from lead payloads (tilbudsmotoren) over a
// trailing window, plus order task categories as a delivery-side view.
export async function serviceStats(args: { days?: number }) {
  const days = Math.min(Math.max(args.days ?? 90, 1), 730);
  const since = new Date(Date.now() - days * DAY_MS);

  const leads = await prisma.lead.findMany({ where: { createdAt: { gte: since } }, select: { payload: true } });
  const leadServiceCount = new Map<string, number>();
  for (const l of leads) {
    for (const s of parsePayload(l.payload)?.services ?? []) {
      const n = s.navn?.trim();
      if (n) leadServiceCount.set(n, (leadServiceCount.get(n) ?? 0) + 1);
    }
  }

  const orders = await prisma.order.findMany({
    where: { plannedAt: { gte: since } },
    select: { tasks: { select: { category: true, description: true } } },
  });
  const taskCount = new Map<string, number>();
  for (const o of orders) for (const t of o.tasks) {
    const n = t.description?.trim() || t.category;
    taskCount.set(n, (taskCount.get(n) ?? 0) + 1);
  }

  const rank = (m: Map<string, number>) =>
    [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const leadRanked = rank(leadServiceCount);
  const taskRanked = rank(taskCount);
  return {
    windowDays: days,
    leadServices: { most: leadRanked.slice(0, 5), least: leadRanked.slice(-5).reverse(), total: leadRanked.length },
    orderTasks: { most: taskRanked.slice(0, 5), least: taskRanked.slice(-5).reverse(), total: taskRanked.length },
  };
}

// ---- daily_overview --------------------------------------------------------
// Karl's morning briefing. Leads new-yesterday + this-week total, compared to the
// day before and the same weekday last week; most/least chosen services; needs-
// action items (unanswered leads / stalled offers / calendar gaps); and upsell /
// retention candidates. Built from Lead + Order data; service ranking reuses
// serviceStats above.
export async function dailyOverview(args: { refDate?: string } = {}) {
  const now = args.refDate ? new Date(`${args.refDate}T12:00:00Z`) : new Date();
  const today = startOfUTC(now);
  const yesterday = new Date(today.getTime() - DAY_MS);
  const dayBefore = new Date(today.getTime() - 2 * DAY_MS);
  const sameWeekdayLastWeek = new Date(today.getTime() - 7 * DAY_MS);
  const weekMonday = new Date(`${mondayISOOf(ymd(today))}T00:00:00Z`);

  const countLeadsBetween = (from: Date, to: Date) =>
    prisma.lead.count({ where: { createdAt: { gte: from, lt: to } } });

  const [newYesterday, newDayBefore, newSameWeekdayLastWeek, newThisWeek, openLeads] = await Promise.all([
    countLeadsBetween(yesterday, today),
    countLeadsBetween(dayBefore, yesterday),
    countLeadsBetween(sameWeekdayLastWeek, new Date(sameWeekdayLastWeek.getTime() + DAY_MS)),
    countLeadsBetween(weekMonday, new Date(today.getTime() + DAY_MS)),
    prisma.lead.findMany({ where: { status: { in: ["new", "contacted"] } }, orderBy: { createdAt: "asc" } }),
  ]);

  // Needs-action.
  const staleCutoff = new Date(today.getTime() - 3 * DAY_MS);
  const unansweredLeads = openLeads.filter((l) => l.status === "new");
  const stalledOffers = openLeads.filter((l) => l.status === "contacted" && l.createdAt < staleCutoff);

  // Calendar gaps: active handymen with NO open orders in the next 7 days.
  const weekEnd = new Date(today.getTime() + 7 * DAY_MS);
  const activeEmployees = await prisma.user.findMany({ where: { active: true, activeCalendar: true }, select: { id: true, firstName: true, lastName: true } });
  const upcoming = await prisma.order.groupBy({
    by: ["employeeId"],
    where: { plannedAt: { gte: today, lt: weekEnd }, status: { notIn: ["Afsluttet", "Udført", "Sprunget over"] } },
    _count: { _all: true },
  });
  const bookedIds = new Set(upcoming.map((u) => u.employeeId));
  const calendarGaps = activeEmployees
    .filter((e) => !bookedIds.has(e.id))
    .map((e) => ({ employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}` }));

  // Upsell / retention candidates.
  // Upsell: online/manual customers (order in last 12 mo) with NO active subscription.
  // Retention: contacts whose most recent order is >120 days old.
  const yearAgo = new Date(today.getTime() - 365 * DAY_MS);
  const recentOrders = await prisma.order.findMany({
    where: { plannedAt: { gte: yearAgo } },
    select: { contactId: true, plannedAt: true, sourceType: true, contact: { select: { name: true } } },
    orderBy: { plannedAt: "desc" },
  });
  const lastOrderByContact = new Map<number, { name: string; last: Date; sources: Set<string> }>();
  for (const o of recentOrders) {
    const cur = lastOrderByContact.get(o.contactId);
    if (cur) { cur.sources.add(o.sourceType); }
    else lastOrderByContact.set(o.contactId, { name: o.contact.name, last: o.plannedAt, sources: new Set([o.sourceType]) });
  }
  const activeSubContactIds = new Set(
    (await prisma.subscription.findMany({ where: { active: true }, select: { contactId: true } })).map((s) => s.contactId)
  );
  const upsellCandidates: { contactId: number; name: string; reason: string }[] = [];
  const retentionCandidates: { contactId: number; name: string; lastOrder: string }[] = [];
  const retentionCutoff = new Date(today.getTime() - 120 * DAY_MS);
  for (const [contactId, info] of lastOrderByContact) {
    if (!activeSubContactIds.has(contactId) && [...info.sources].some((s) => s === "online" || s === "manual")) {
      upsellCandidates.push({ contactId, name: info.name, reason: "Ingen aktivt abonnement — tilbyd fast aftale" });
    }
    if (info.last < retentionCutoff) {
      retentionCandidates.push({ contactId, name: info.name, lastOrder: ymd(info.last) });
    }
  }

  const services = await serviceStats({ days: 90 });

  const delta = (cur: number, prev: number) => ({ current: cur, previous: prev, change: cur - prev });

  return {
    date: ymd(today),
    leads: {
      newYesterday: delta(newYesterday, newDayBefore),
      vsSameWeekdayLastWeek: delta(newYesterday, newSameWeekdayLastWeek),
      newThisWeek,
    },
    services: { mostChosen: services.leadServices.most, leastChosen: services.leadServices.least },
    needsAction: {
      unansweredLeads: unansweredLeads.map((l) => ({ id: l.id, name: l.name, phone: l.phone, createdAt: l.createdAt.toISOString() })),
      stalledOffers: stalledOffers.map((l) => ({ id: l.id, name: l.name, phone: l.phone, createdAt: l.createdAt.toISOString() })),
      calendarGaps,
    },
    upsellCandidates: upsellCandidates.slice(0, 20),
    retentionCandidates: retentionCandidates.slice(0, 20),
  };
}

export type { Slot };
