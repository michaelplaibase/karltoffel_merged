const WEEK_MS = 7 * 864e5;

export type PreviewTask = {
  id: number;
  category: string;
  description: string;
  price: number;
  durationMin: number;
  intervalMultiplier: string | null;
  startWeek: string | null;
  pauseActive: boolean;
  pauseStart: string | null;
  pauseEnd: string | null;
  pauseYearly: boolean;
};

export type PreviewSubscription = {
  id: number;
  displayNo: number;
  contactId: number;
  customer: string;
  phone: string | null;
  deliveryAddress: string;
  baseInterval: string;
  startWeek: string | null;
  fixedWeekdays: string | null;
  fixedEmployeeId: number | null;
  active?: boolean;
  tasks: readonly PreviewTask[];
};

export type PreviewHoliday = { startWeek: Date; endWeek: Date };

export type PreviewVisit = {
  subscriptionId: number;
  subscriptionNo: number;
  contactId: number;
  customer: string;
  phone: string | null;
  deliveryAddress: string;
  fixedWeekdays: number[] | undefined;
  fixedEmployeeId: number | null;
  week: string;
  tasks: PreviewTask[];
};

export type PreviewProjectionOptions = {
  referenceDate: Date;
  horizonWeeks?: number;
  holidays: readonly PreviewHoliday[];
};

function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = (jan4.getUTCDay() + 6) % 7;
  return new Date(jan4.getTime() - jan4Weekday * 864e5 + (week - 1) * WEEK_MS);
}

export function mondayOf(date: Date): Date {
  const weekday = (date.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(midnight - weekday * 864e5);
}

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseBaseInterval(label: string): number {
  const match = label.match(/Hver\s+(\d+)\.\s*uge/i);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function parseMultiplier(label: string | null): number | null {
  if (!label) return 1;
  if (/anmodning/i.test(label)) return null;
  const match = label.match(/Hver\s+(\d+)\.\s*gang/i);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function parseWeekLabel(label: string | null): number | null {
  if (!label) return null;
  const match = label.trim().match(/^(?:Uge\s*)?(\d{1,2})$/i);
  const week = match ? Number(match[1]) : 0;
  return week >= 1 && week <= 53 ? week : null;
}

function isoWeekYear(date: Date): number {
  const thursday = new Date(mondayOf(date).getTime() + 3 * 864e5);
  return thursday.getUTCFullYear();
}

function nextIsoWeek(referenceMonday: number, week: number): number {
  const year = isoWeekYear(new Date(referenceMonday));
  for (const candidateYear of [year, year + 1]) {
    const candidate = mondayOfIsoWeek(candidateYear, week);
    if (isoWeekYear(candidate) === candidateYear && candidate.getTime() >= referenceMonday) return candidate.getTime();
  }
  return mondayOfIsoWeek(year + 2, week).getTime();
}

function phaseIsoWeek(referenceMonday: number, week: number): number {
  const year = isoWeekYear(new Date(referenceMonday));
  const candidate = mondayOfIsoWeek(year, week);
  if (isoWeekYear(candidate) === year) return candidate.getTime();
  return nextIsoWeek(referenceMonday, week);
}

function isTaskPaused(task: PreviewTask, week: number): boolean {
  if (!task.pauseActive || !task.pauseStart || !task.pauseEnd) return false;
  const start = new Date(`${task.pauseStart}T00:00:00Z`);
  const end = new Date(`${task.pauseEnd}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  if (!task.pauseYearly) return week >= start.getTime() && week <= end.getTime();

  const date = new Date(week);
  const value = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const startValue = (start.getUTCMonth() + 1) * 100 + start.getUTCDate();
  const endValue = (end.getUTCMonth() + 1) * 100 + end.getUTCDate();
  return startValue <= endValue
    ? value >= startValue && value <= endValue
    : value >= startValue || value <= endValue;
}

function fixedWeekdays(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const days = [...value].map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return days.length ? days : undefined;
}

/**
 * Pure, read-only projection of subscription visits. It mirrors recurrence.ts,
 * but deliberately knows nothing about Prisma or persistence.
 *
 * Conservative preview semantics: missing/invalid startWeek produces no visits,
 * "På anmodning" is omitted, and holiday weeks stay empty. Existing
 * Order rows are intentionally irrelevant because Kalender 2 previews the active
 * subscription templates rather than the materialised calendar. Old
 * SubscriptionWeekSkip tombstones are also intentionally ignored, because they
 * belong to manual deletions in the calendar being replaced, not subscription data.
 */
export function projectSubscriptionVisits(
  subscriptions: readonly PreviewSubscription[],
  options: PreviewProjectionOptions,
): PreviewVisit[] {
  const horizonWeeks = Math.max(0, options.horizonWeeks ?? 26);
  const thisMonday = mondayOf(options.referenceDate).getTime();
  const horizonEnd = thisMonday + horizonWeeks * WEEK_MS;
  const isHoliday = (week: number) => options.holidays.some((holiday) =>
    week >= mondayOf(holiday.startWeek).getTime() && week <= mondayOf(holiday.endWeek).getTime());
  const visits: PreviewVisit[] = [];

  for (const subscription of subscriptions) {
    if (subscription.active === false) continue;
    const base = parseBaseInterval(subscription.baseInterval);
    const subscriptionWeek = parseWeekLabel(subscription.startWeek);
    if (subscriptionWeek == null) continue;

    const tasks = subscription.tasks.map((item) => ({
      item,
      multiplier: parseMultiplier(item.intervalMultiplier),
      anchor: phaseIsoWeek(thisMonday, parseWeekLabel(item.startWeek) ?? subscriptionWeek),
    }));

    for (let visitWeek = thisMonday; visitWeek < horizonEnd; visitWeek += WEEK_MS) {
      if (isHoliday(visitWeek)) continue;
      const due = tasks
        .filter(({ item, multiplier, anchor: taskAnchor }) => multiplier != null
          && visitWeek >= taskAnchor
          && (visitWeek - taskAnchor) % (base * WEEK_MS * multiplier) === 0
          && !isTaskPaused(item, visitWeek))
        .map(({ item }) => ({ ...item }));
      if (!due.length) continue;

      visits.push({
        subscriptionId: subscription.id,
        subscriptionNo: subscription.displayNo,
        contactId: subscription.contactId,
        customer: subscription.customer,
        phone: subscription.phone,
        deliveryAddress: subscription.deliveryAddress,
        fixedWeekdays: fixedWeekdays(subscription.fixedWeekdays),
        fixedEmployeeId: subscription.fixedEmployeeId,
        week: ymd(new Date(visitWeek)),
        tasks: due,
      });
    }
  }

  return visits.sort((a, b) => a.week.localeCompare(b.week) || a.subscriptionId - b.subscriptionId);
}
