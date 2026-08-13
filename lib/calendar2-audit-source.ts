import { prisma } from "./db";

const parseFixedWeekdays = (value: string | null): number[] | null => value
  ? [...new Set([...value].map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b)
  : null;

export async function getCalendar2AuditSource() {
  const [subscriptions, users, holidays] = await Promise.all([
    prisma.subscription.findMany({
      where: { active: true },
      select: {
        id: true, displayNo: true, baseInterval: true, startWeek: true,
        fixedWeekdays: true, fixedEmployee: true, active: true,
        tasks: { select: {
          id: true, durationMin: true, intervalMultiplier: true, startWeek: true,
          pauseActive: true, pauseStart: true, pauseEnd: true, pauseYearly: true,
        }, orderBy: { sort: "asc" } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, active: true, activeCalendar: true },
      orderBy: { id: "asc" },
    }),
    prisma.holidayWeek.findMany({ select: { id: true, startWeek: true, endWeek: true }, orderBy: { startWeek: "asc" } }),
  ]);
  const employeeByIdentity = new Map(users.map((user) => [`${user.firstName} ${user.lastName}`, user.id]));
  return {
    version: "calendar2-source-audit-v1",
    subscriptions: subscriptions.map((subscription) => {
      const noEmployee = subscription.fixedEmployee === "Ingen" || !subscription.fixedEmployee.trim();
      const fixedEmployeeId = noEmployee ? null : employeeByIdentity.get(subscription.fixedEmployee) ?? null;
      return {
        stableRef: `subscription:${subscription.displayNo}`,
        subscriptionId: subscription.id,
        subscriptionNo: subscription.displayNo,
        active: subscription.active,
        baseInterval: subscription.baseInterval,
        startWeek: subscription.startWeek,
        fixedWeekdays: parseFixedWeekdays(subscription.fixedWeekdays),
        fixedEmployeeIdentity: noEmployee ? null : fixedEmployeeId == null ? "unresolved" : `employee:${fixedEmployeeId}`,
        fixedEmployeeId,
        fixedEmployeeResolution: noEmployee ? "none" : fixedEmployeeId == null ? "unresolved" : "resolved",
        tasks: subscription.tasks.map((task) => ({
          stableRef: `task:${task.id}`, taskId: task.id, durationMin: task.durationMin,
          intervalMultiplier: task.intervalMultiplier, startWeek: task.startWeek,
          pauseActive: task.pauseActive, pauseStart: task.pauseStart, pauseEnd: task.pauseEnd, pauseYearly: task.pauseYearly,
        })),
      };
    }),
    employees: users.map((user) => ({
      stableRef: `employee:${user.id}`, employeeId: user.id, active: user.active, activeCalendar: user.activeCalendar,
      workStartMin: 480, workEndMin: 960, flexMin: 60, workdays: [0, 1, 2, 3, 4],
    })),
    holidays: holidays.map((holiday) => ({ stableRef: `holiday:${holiday.id}`, holidayId: holiday.id, startWeek: holiday.startWeek.toISOString(), endWeek: holiday.endWeek.toISOString() })),
  };
}