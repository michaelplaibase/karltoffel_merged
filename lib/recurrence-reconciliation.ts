const WEEK_MS = 7 * 864e5;

export type AuthoritativeTask = {
  id: number; category: string; letter: string; color: string; description: string; price: number;
  durationMin: number; intervalMultiplier: string | null; startWeek: string | null; isStandardTask: boolean;
  pauseActive: boolean; pauseStart: string | null; pauseEnd: string | null; pauseYearly: boolean;
};
export type ReconciliationSubscription = {
  id: number; contactId: number; deliveryAddress: string; baseInterval: string; startWeek: string | null;
  fixedEmployeeId: number | null; active: boolean; tasks: AuthoritativeTask[];
};
export type ReconciliationOrder = {
  id: number; subscriptionId: number | null; sourceWeek: Date | null; plannedAt: Date; status: string;
  lockedFully: boolean; contactId: number; deliveryAddress: string; employeeId: number | null; sourceType: string;
  tasks: Array<AuthoritativeTask & { id: number }>;
};
export type ExpectedOrder = {
  subscriptionId: number; sourceWeek: Date; plannedAt: Date; contactId: number; deliveryAddress: string;
  employeeId: number | null; sourceType: "subscription"; tasks: Omit<AuthoritativeTask, "id" | "pauseActive" | "pauseStart" | "pauseEnd" | "pauseYearly">[];
};
export type ReconciliationPlan = {
  expected: ExpectedOrder[]; expectedWeeks: string[];
  creates: ExpectedOrder[];
  updates: Array<ExpectedOrder & { orderId: number; preservePlannedAt: true; lockedFully: boolean }>;
  deletes: Array<{ orderId: number; subscriptionId: number; sourceWeek: Date; lockedFully: boolean; reason: "duplicate" | "not_expected" }>;
  ignoredOrders: number; changes: number;
};
export type ReconciliationInput = {
  subscriptions: ReconciliationSubscription[]; orders: ReconciliationOrder[];
  tombstones: Array<{ subscriptionId: number; week: Date }>;
  holidays: Array<{ startWeek: Date; endWeek: Date }>;
};

function mondayOf(d: Date): Date {
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * 864e5);
}
function isoYear(d: Date): number { return new Date(mondayOf(d).getTime() + 3 * 864e5).getUTCFullYear(); }
function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return new Date(mondayOf(jan4).getTime() + (week - 1) * WEEK_MS);
}
function parseWeek(label: string | null): number | null {
  const m = label?.trim().match(/^(?:Uge\s*)?(\d{1,2})$/i); const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 53 ? n : null;
}
function baseInterval(label: string): number { return Math.max(1, Number(label.match(/Hver\s+(\d+)\.\s*uge/i)?.[1] ?? 1)); }
function multiplier(label: string | null): number | null {
  if (label && /anmodning/i.test(label)) return null;
  return Math.max(1, Number(label?.match(/Hver\s+(\d+)\.\s*gang/i)?.[1] ?? 1));
}
function paused(t: AuthoritativeTask, ms: number): boolean {
  if (!t.pauseActive || !t.pauseStart || !t.pauseEnd) return false;
  const ymd = new Date(ms).toISOString().slice(0, 10);
  if (!t.pauseYearly) return ymd >= t.pauseStart && ymd <= t.pauseEnd;
  const md = ymd.slice(5), start = t.pauseStart.slice(5), end = t.pauseEnd.slice(5);
  return start <= end ? md >= start && md <= end : md >= start || md <= end;
}
function taskRow(t: AuthoritativeTask, sort: number) {
  return { category: t.category, letter: t.letter, color: t.color, description: t.description, price: t.price,
    durationMin: t.durationMin, intervalMultiplier: t.intervalMultiplier, startWeek: t.startWeek,
    isStandardTask: t.isStandardTask, sort };
}
function taskSignature(tasks: Array<Record<string, unknown>>): string {
  return JSON.stringify(tasks.map(({ category, letter, color, description, price, durationMin, intervalMultiplier, startWeek, isStandardTask, sort }, index) =>
    ({ category, letter, color, description, price, durationMin, intervalMultiplier, startWeek, isStandardTask, sort: sort ?? index })));
}
function expectedOrders(input: ReconciliationInput, ref: Date, horizonWeeks: number): ExpectedOrder[] {
  const first = mondayOf(ref).getTime(), end = first + Math.max(0, horizonWeeks - 1) * WEEK_MS;
  const tombstones = new Set(input.tombstones.map(x => `${x.subscriptionId}:${mondayOf(x.week).getTime()}`));
  const holiday = (v: number) => input.holidays.some(h => v >= mondayOf(h.startWeek).getTime() && v <= mondayOf(h.endWeek).getTime());
  const result: ExpectedOrder[] = [];
  for (const sub of input.subscriptions.filter(s => s.active).sort((a, b) => a.id - b.id)) {
    const sw = parseWeek(sub.startWeek); if (sw == null) continue;
    const base = baseInterval(sub.baseInterval), step = base * WEEK_MS, year = isoYear(ref);
    let anchor = mondayOfIsoWeek(year, sw).getTime();
    if (isoYear(new Date(anchor)) !== year || anchor > end) anchor = mondayOfIsoWeek(year - 1, sw).getTime();
    let v = anchor; if (v < first) v += Math.ceil((first - v) / step) * step;
    for (; v <= end; v += step) {
      if (holiday(v) || tombstones.has(`${sub.id}:${v}`)) continue;
      const visitIndex = Math.round((v - anchor) / step);
      const due = sub.tasks.filter(t => {
        const m = multiplier(t.intervalMultiplier), tw = parseWeek(t.startWeek) ?? sw;
        const offset = Math.round((tw - sw) / base);
        return m != null && visitIndex >= offset && (visitIndex - offset) % m === 0 && !paused(t, v);
      });
      if (!due.length) continue;
      result.push({ subscriptionId: sub.id, sourceWeek: new Date(v), plannedAt: new Date(v + 10 * 3600e3),
        contactId: sub.contactId, deliveryAddress: sub.deliveryAddress, employeeId: sub.fixedEmployeeId,
        sourceType: "subscription", tasks: due.map(taskRow) });
    }
  }
  return result;
}

/** Pure deterministic audit/plan. It never mutates its inputs or persistence. */
export function buildRecurrenceReconciliationPlan(input: ReconciliationInput, options: { referenceDate: Date; horizonWeeks?: number }): ReconciliationPlan {
  const expected = expectedOrders(input, options.referenceDate, options.horizonWeeks ?? 26);
  const expectedByKey = new Map(expected.map(e => [`${e.subscriptionId}:${e.sourceWeek.getTime()}`, e]));
  const eligible = input.orders.filter(o => o.subscriptionId != null && o.status === "Afventer levering" && mondayOf(o.sourceWeek ?? o.plannedAt).getTime() >= mondayOf(options.referenceDate).getTime());
  const grouped = new Map<string, ReconciliationOrder[]>();
  for (const o of eligible) {
    const key = `${o.subscriptionId}:${mondayOf(o.sourceWeek ?? o.plannedAt).getTime()}`;
    // Prefer the intentionally moved row when imported duplicates exist; then
    // fall back to the stable lowest id. This avoids deleting a user's move.
    grouped.set(key, [...(grouped.get(key) ?? []), o].sort((a, b) => {
      const plannedDay = (row: ReconciliationOrder) => row.plannedAt.toISOString().slice(0, 10);
      const sourceDay = (row: ReconciliationOrder) => mondayOf(row.sourceWeek ?? row.plannedAt).toISOString().slice(0, 10);
      const aMoved = plannedDay(a) !== sourceDay(a);
      const bMoved = plannedDay(b) !== sourceDay(b);
      return Number(bMoved) - Number(aMoved) || a.id - b.id;
    }));
  }
  const creates: ExpectedOrder[] = [], updates: ReconciliationPlan["updates"] = [], deletes: ReconciliationPlan["deletes"] = [];
  for (const e of expected) {
    const key = `${e.subscriptionId}:${e.sourceWeek.getTime()}`, rows = grouped.get(key) ?? [];
    if (!rows.length) { creates.push(e); continue; }
    const keep = rows[0];
    for (const duplicate of rows.slice(1)) deletes.push({ orderId: duplicate.id, subscriptionId: e.subscriptionId, sourceWeek: e.sourceWeek, lockedFully: duplicate.lockedFully, reason: "duplicate" });
    const stale = keep.contactId !== e.contactId || keep.deliveryAddress !== e.deliveryAddress || keep.employeeId !== e.employeeId || keep.sourceType !== "subscription" || taskSignature(keep.tasks) !== taskSignature(e.tasks);
    if (stale) updates.push({ ...e, orderId: keep.id, preservePlannedAt: true, lockedFully: keep.lockedFully });
    grouped.delete(key);
  }
  for (const [key, rows] of grouped) if (!expectedByKey.has(key)) for (const o of rows)
    deletes.push({ orderId: o.id, subscriptionId: o.subscriptionId!, sourceWeek: mondayOf(o.sourceWeek ?? o.plannedAt), lockedFully: o.lockedFully, reason: "not_expected" });
  deletes.sort((a, b) => a.subscriptionId - b.subscriptionId || a.sourceWeek.getTime() - b.sourceWeek.getTime() || a.orderId - b.orderId);
  const expectedWeeks = expected.map(e => `${e.subscriptionId}:${e.sourceWeek.toISOString().slice(0, 10)}`);
  return { expected, expectedWeeks, creates, updates, deletes, ignoredOrders: input.orders.length - eligible.length, changes: creates.length + updates.length + deletes.length };
}
