import { prisma } from "./db";
import { coordFor } from "./geo";
import { isoWeek, planWeek, type Employee as PlannerEmployee, type Job } from "./planner";
import type {
  CalendarMonth, CalendarWeek, CalEvent, Employee, MonthCell, MonthDay,
  MonthMatrixRow, MonthWeek, UnplannedJob, WeekDay,
} from "./calendar";
import { projectSubscriptionVisits, ymd, type PreviewSubscription, type PreviewVisit } from "./subscription-preview";

const WEEK_MS = 7 * 864e5;
const MON_SHORT = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];
const MONTHS = ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"];
const DA_DAYS = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const postalOf = (address: string) => address.match(/\b\d{4}\s+[^,]+/)?.[0] ?? address;

function previewId(visit: PreviewVisit): number {
  return -(visit.subscriptionId * 100_000_000 + Math.floor(new Date(`${visit.week}T00:00:00Z`).getTime() / WEEK_MS));
}

async function loadPreviewSource() {
  const [rows, users, holidays] = await Promise.all([
    prisma.subscription.findMany({
      where: { active: true },
      include: { tasks: { orderBy: { sort: "asc" } }, contact: { select: { name: true, phone: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.user.findMany({ where: { activeCalendar: true }, orderBy: { id: "asc" } }),
    prisma.holidayWeek.findMany({ orderBy: { startWeek: "asc" } }),
  ]);
  const employeeByName = new Map(users.map((user) => [`${user.firstName} ${user.lastName}`, user.id]));
  const fallbackEmployeeId = users[0]?.id ?? null;
  const subscriptions: PreviewSubscription[] = rows.map((row) => ({
    id: row.id,
    displayNo: row.displayNo,
    contactId: row.contactId,
    customer: row.contact.name,
    phone: row.contact.phone,
    deliveryAddress: row.deliveryAddress,
    baseInterval: row.baseInterval,
    startWeek: row.startWeek,
    fixedWeekdays: row.fixedWeekdays,
    fixedEmployeeId: employeeByName.get(row.fixedEmployee) ?? fallbackEmployeeId,
    active: row.active,
    tasks: row.tasks.map((task) => ({
      id: task.id,
      category: task.category,
      description: task.description,
      price: task.price,
      durationMin: task.durationMin,
      intervalMultiplier: task.intervalMultiplier,
      startWeek: task.startWeek,
    })),
  }));
  const employees: Employee[] = users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    color: user.calendarColor ?? "#a4d5ee",
    active: user.activeCalendar,
  }));
  const plannerEmployees: PlannerEmployee[] = users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    home: coordFor(user.homeAddress ?? ""),
    workStartMin: 8 * 60,
    workEndMin: 16 * 60,
    flexMin: 60,
    workdays: [0, 1, 2, 3, 4],
  }));
  return { subscriptions, employees, plannerEmployees, holidays };
}

async function buildPreviewWeek(weekMonday: string) {
  const source = await loadPreviewSource();
  const visits = projectSubscriptionVisits(source.subscriptions, {
    referenceDate: new Date(),
    horizonWeeks: 26,
    holidays: source.holidays,
  }).filter((visit) => visit.week === weekMonday);
  const priceById = new Map<number, number>();
  const visitById = new Map<number, PreviewVisit>();
  const jobs: Job[] = visits.map((visit) => {
    const id = previewId(visit);
    priceById.set(id, visit.tasks.reduce((sum, task) => sum + task.price, 0));
    visitById.set(id, visit);
    return {
      id,
      contactId: visit.contactId,
      customer: visit.customer,
      address: visit.deliveryAddress,
      postal: postalOf(visit.deliveryAddress),
      category: visit.tasks[0]?.category ?? "Andet",
      durationMin: visit.tasks.reduce((sum, task) => sum + task.durationMin, 0) || 30,
      source: `Abo. #${visit.subscriptionNo}`,
      fixedWeekdays: visit.fixedWeekdays,
      fixedEmployeeId: visit.fixedEmployeeId ?? undefined,
    };
  });
  const activeIds = new Set(source.employees.map((employee) => employee.id));
  const placeable = jobs.filter((job) => job.fixedEmployeeId != null && activeIds.has(job.fixedEmployeeId));
  const unassigned = jobs.filter((job) => job.fixedEmployeeId == null || !activeIds.has(job.fixedEmployeeId));
  const plan = planWeek(placeable, weekMonday, source.plannerEmployees);
  return { ...source, visits, jobs, priceById, visitById, plan, unassigned };
}

export async function getSubscriptionPreviewWeek(weekMonday: string): Promise<CalendarWeek> {
  const data = await buildPreviewWeek(weekMonday);
  const start = new Date(`${weekMonday}T00:00:00Z`);
  const revenue = Array<number>(7).fill(0);
  for (const day of data.plan.days) for (const stop of day.stops) revenue[day.weekday] += data.priceById.get(stop.job.id) ?? 0;
  const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => ({
    label: DA_DAYS[index],
    date: String(new Date(start.getTime() + index * 864e5).getUTCDate()),
    revenue: revenue[index],
  }));
  const events: CalEvent[] = data.plan.days.flatMap((day) => day.stops.map((stop) => {
    const visit = data.visitById.get(stop.job.id)!;
    return {
      id: stop.job.id,
      day: day.weekday,
      start: stop.startMin / 60,
      end: stop.endMin / 60,
      postal: stop.job.postal,
      customer: stop.job.customer,
      category: stop.job.category,
      status: "afventer",
      type: "abonnement",
      lock: "frigjort",
      employeeId: day.employeeId,
      contactId: stop.job.contactId,
      subscriptionNo: visit.subscriptionNo,
      phone: visit.phone,
    };
  }));
  const unplannedJobs = [...data.plan.unplanned, ...data.unassigned];
  const unplanned: UnplannedJob[] = unplannedJobs.map((job) => ({
    id: job.id,
    postal: job.postal,
    customer: job.customer,
    category: job.category,
    status: "afventer",
    contactId: job.contactId,
    subscriptionNo: data.visitById.get(job.id)?.subscriptionNo ?? null,
    phone: data.visitById.get(job.id)?.phone ?? null,
    reason: data.unassigned.includes(job) ? "unassigned" : "overflow",
  }));
  const mondayMonth = start.getUTCMonth();
  const sundayMonth = new Date(start.getTime() + 6 * 864e5).getUTCMonth();
  const weekNo = isoWeek(weekMonday);
  const weekRevenue = revenue.reduce((sum, amount) => sum + amount, 0);
  return {
    weekNo,
    weekLabel: `${cap(MON_SHORT[mondayMonth])}${mondayMonth !== sundayMonth ? ` – ${cap(MON_SHORT[sundayMonth])}` : ""} ${start.getUTCFullYear()}`,
    monday: weekMonday,
    employees: data.employees,
    days,
    events,
    unplanned,
    planned: { weekLabel: `Uge ${weekNo}`, week: weekRevenue, monthLabel: MONTHS[mondayMonth], month: weekRevenue },
  };
}

export async function getSubscriptionPreviewMonth(monthParam: string): Promise<CalendarMonth> {
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIdx = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIdx, 1));
  const last = new Date(Date.UTC(year, monthIdx + 1, 0));
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 864e5);
  const today = ymd(now);
  const weeks: MonthWeek[] = [];
  const calendarWeeks: CalendarWeek[] = [];
  for (let monday = gridStart; monday <= last; monday = new Date(monday.getTime() + WEEK_MS)) {
    const mondayISO = ymd(monday);
    const week = await getSubscriptionPreviewWeek(mondayISO);
    calendarWeeks.push(week);
    const holiday = await prisma.holidayWeek.count({ where: { startWeek: { lte: monday }, endWeek: { gte: monday } } }) > 0;
    const days: MonthDay[] = Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(monday.getTime() + weekday * 864e5);
      const dateISO = ymd(date);
      return {
        dateISO,
        dateNum: date.getUTCDate(),
        weekday,
        inMonth: date.getUTCMonth() === monthIdx,
        isToday: dateISO === today,
        chips: week.events.filter((event) => event.day === weekday).map((event) => ({
          id: event.id,
          weekday,
          employeeId: event.employeeId,
          label: event.customer || event.postal,
          postal: event.postal,
          category: event.category,
          status: event.status,
          contactId: event.contactId,
        })),
      };
    });
    weeks.push({ weekNo: week.weekNo, monday: mondayISO, holiday, days });
  }
  const employees = calendarWeeks[0]?.employees ?? [];
  const zero = (): MonthCell => ({ count: 0, revenue: 0 });
  const add = (a: MonthCell, b: MonthCell): MonthCell => ({ count: a.count + b.count, revenue: a.revenue + b.revenue });
  const matrix: MonthMatrixRow[] = employees.map((employee) => {
    const cells = calendarWeeks.map((week) => {
      const events = week.events.filter((event) => event.employeeId === employee.id);
      return { count: events.length, revenue: week.days.reduce((sum, day) => sum + day.revenue, 0) };
    });
    return { employeeId: employee.id, cells, total: cells.reduce(add, zero()) };
  });
  const colTotals = weeks.map((_, index) => matrix.reduce((total, row) => add(total, row.cells[index]), zero()));
  const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    year,
    monthIdx,
    monthLabel: `${MONTHS[monthIdx]} ${year}`,
    monthParam: monthKey(first),
    prevMonth: monthKey(new Date(Date.UTC(year, monthIdx - 1, 1))),
    nextMonth: monthKey(new Date(Date.UTC(year, monthIdx + 1, 1))),
    employees,
    weeks,
    weekNos: weeks.map((week) => week.weekNo),
    matrix,
    colTotals,
    grandTotal: colTotals.reduce(add, zero()),
  };
}
