// Daglig faktura-status-mail til Thomas (ejeren, ikke-teknisk): "gik alle
// fakturaer ud i går?" Kører som Vercel-cron (se vercel.json) og kan også
// trigges manuelt af en indlogget administrator. STRIKT LÆSE-KUN: ruten læser
// kun databasen og sender en mail — den kalder aldrig Dinero og kan aldrig
// udløse fakturering (sammenlign lib/business-invoicing.ts, som skriver).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email";
import { buildInvoiceReport, formatInvoiceReportText, cphYesterdayWindow, type ReportOrder } from "@/lib/invoice-report";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Modtager: env-innstilling først (INVOICE_REPORT_TO), ellers første aktive
 *  administrators e-mail fra User-tabellen, til sidst firma-adressen. */
async function resolveRecipient(): Promise<string> {
  const env = process.env.INVOICE_REPORT_TO?.trim();
  if (env) return env;
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true, active: true, email: { not: null } },
    select: { email: true },
    orderBy: { id: "asc" },
  });
  return admin?.email ?? "hej@karltoffel.dk";
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  // Kørsel via cron (Bearer CRON_SECRET) eller af en indlogget ADMINISTRATOR —
  // samme mønster som /api/business-invoicing.
  if (!isCron) {
    const me = await getSessionUser();
    if (me == null) return unauthorized();
    if (!me.isAdmin) return forbidden();
  }

  // "I går" i dansk tid — rapporten omhandler den danske arbejdsdag.
  const { from: winFrom, to: winTo, day } = cphYesterdayWindow(new Date());

  // Læs relevante ordrer: alt leveret inden i dag (fakturering gælder kun
  // fortids-ordrer, samme konvention som faktureringsoversigten) og oprettet
  // inden for de seneste ~90 dage (dækker "i går" + udstående fejl/problem-
  // ordrer uden at trække hele historikken). tasks medtages kun for pris-sum.
  const now = new Date();
  const orders = await prisma.order.findMany({
    where: { plannedAt: { lt: new Date(now), gte: new Date(now.getTime() - 90 * 864e5) } },
    include: { tasks: { select: { price: true } }, contact: { select: { name: true } } },
    orderBy: { plannedAt: "desc" },
    take: 2000,
  });

  const reportOrders: ReportOrder[] = orders.map((o) => ({
    id: o.id,
    customer: o.contact.name,
    price: o.tasks.reduce((a, t) => a + t.price, 0),
    status: o.status,
    plannedAt: o.plannedAt,
    invoiceDecision: o.invoiceDecision,
    dineroInvoiceGuid: o.dineroInvoiceGuid,
    dineroInvoiceStatus: o.dineroInvoiceStatus,
    dineroInvoiceNumber: o.dineroInvoiceNumber,
    dineroError: o.dineroError,
    invoicedAt: o.invoicedAt,
    businessBatchInvoiceGuid: o.businessBatchInvoiceGuid,
    businessBatchInvoiceStatus: o.businessBatchInvoiceStatus,
    businessBatchInvoiceNumber: o.businessBatchInvoiceNumber,
    businessBatchError: o.businessBatchError,
    businessBatchInvoicedAt: o.businessBatchInvoicedAt,
  }));

  const report = buildInvoiceReport(reportOrders, winFrom, winTo);
  const text = formatInvoiceReportText(report, day);
  const to = await resolveRecipient();
  const result = await sendEmail({ to, subject: `Faktura-rapport ${day} — sendt: ${report.sentPerOrder.length + report.sentBatches.length}, mangler: ${report.readyNotInvoiced.length}`, text });

  return NextResponse.json({
    ok: result.ok,
    simulated: result.simulated ?? false,
    to,
    day,
    sentPerOrder: report.sentPerOrder.length,
    sentBatches: report.sentBatches.length,
    readyNotInvoiced: report.readyNotInvoiced.length,
    errors: report.errors.length,
    totalSent: report.totalSent,
  });
}
