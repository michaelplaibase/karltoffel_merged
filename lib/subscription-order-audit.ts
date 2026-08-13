import { prisma } from "./db";

function mondayOf(date: Date): Date {
  const weekday = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - weekday * 864e5);
}

export async function getSubscriptionOrderAudit(referenceDate = new Date(), horizonWeeks = 26) {
  const from = mondayOf(referenceDate);
  const through = new Date(from.getTime() + Math.max(0, horizonWeeks) * 7 * 864e5);
  const [subscriptions, orders, skips, holidays, users] = await Promise.all([
    prisma.subscription.findMany({
      select: {
        id: true, displayNo: true, contactId: true, deliveryAddress: true, baseInterval: true,
        startWeek: true, nextWeek: true, fixedWeekdays: true, fixedTimeOfDay: true,
        fixedEmployee: true, active: true, pending: true, createdAt: true,
        contact: { select: { name: true } },
        tasks: { select: {
          id: true, category: true, letter: true, description: true, price: true,
          durationMin: true, intervalMultiplier: true, startWeek: true,
          pauseActive: true, pauseStart: true, pauseEnd: true, pauseYearly: true,
          customerPresenceRequired: true, isStandardTask: true, fromSubscription: true,
          subscriptionId: true, fixedPriceId: true, orderId: true, color: true, sort: true,
        }, orderBy: { sort: "asc" } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.order.findMany({
      where: { sourceType: "subscription", plannedAt: { gte: from, lte: through } },
      select: {
        id: true, contactId: true, deliveryAddress: true, plannedAt: true, startAt: true,
        status: true, sourceType: true, subscriptionId: true, employeeId: true,
        fixedPriceId: true,
        lockedFully: true, sourceWeek: true, createdAt: true,
        comment: true, addressNote: true, reminderSentAt: true, completedAt: true,
        invoiceDecision: true, dineroInvoiceGuid: true, dineroInvoiceTimeStamp: true,
        dineroInvoiceNumber: true, dineroInvoiceStatus: true, dineroPaymentGuid: true,
        dineroError: true, invoicedAt: true, businessBatchInvoiceGuid: true,
        businessBatchInvoiceTimeStamp: true, businessBatchInvoiceNumber: true,
        businessBatchInvoiceStatus: true, businessBatchInvoicedAt: true,
        businessBatchError: true,
        tasks: { select: {
          id: true, category: true, letter: true, description: true, price: true,
          durationMin: true, intervalMultiplier: true, startWeek: true,
          pauseActive: true, pauseStart: true, pauseEnd: true, pauseYearly: true,
          customerPresenceRequired: true, isStandardTask: true, fromSubscription: true,
          subscriptionId: true, fixedPriceId: true, orderId: true, color: true, sort: true,
        }, orderBy: { sort: "asc" } },
      },
      orderBy: [{ subscriptionId: "asc" }, { sourceWeek: "asc" }, { id: "asc" }],
    }),
    prisma.subscriptionWeekSkip.findMany({
      where: { week: { gte: from, lte: through } },
      select: { id: true, subscriptionId: true, week: true, createdAt: true },
      orderBy: [{ subscriptionId: "asc" }, { week: "asc" }],
    }),
    prisma.holidayWeek.findMany({
      select: { id: true, startWeek: true, endWeek: true }, orderBy: { startWeek: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, active: true, activeCalendar: true },
      orderBy: { id: "asc" },
    }),
  ]);

  return {
    version: "subscription-order-audit-v1",
    generatedAt: new Date().toISOString(),
    range: { from: from.toISOString(), through: through.toISOString(), horizonWeeks },
    counts: { subscriptions: subscriptions.length, orders: orders.length, skips: skips.length },
    subscriptions,
    orders,
    skips,
    holidays,
    users: users.map((user) => ({ ...user, name: `${user.firstName} ${user.lastName}` })),
  };
}
