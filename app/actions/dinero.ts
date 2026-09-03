"use server";

// Server actions for the Dinero (Visma) accounting integration: test the
// client-credentials connection, edit the chart-of-accounts numbers, and (re)issue
// an order's invoice.
import { prisma } from "@/lib/db";
import { guardAction, getSessionUser } from "@/lib/api-auth";
import { issueInvoiceForOrder, testDineroConnection, resolveOrgId, type TestResult } from "@/lib/dinero";
import { revalidatePath } from "next/cache";

// React 19: ukontrollerede formularer nulstilles når en action returnerer —
// values ekkoer derfor de indsendte felter, så indtastningen overlever en fejl.
export type AccountsState = {
  error?: string;
  ok?: boolean;
  values?: { salesAccountNumber: string; cashAccountNumber: string };
};

/** Update the sales/cash Dinero chart-of-accounts numbers (admin only). Upserts the
 *  connection row so numbers can be set before the first "Test forbindelse".
 *  Ugyldigt/tomt input er en VALIDERINGSFEJL — aldrig et stille fallback til
 *  standardkontiene (1000/55040) med "Gemt."-kvittering, som ville lade
 *  bogføringen ramme en anden konto end den, admin troede var valgt. */
export async function saveDineroAccounts(_prev: AccountsState, formData: FormData): Promise<AccountsState> {
  await guardAction();
  const user = await getSessionUser();
  if (!user?.isAdmin) return { error: "Kun administratorer kan ændre regnskabsindstillinger." };

  const salesRaw = String(formData.get("salesAccountNumber") ?? "").trim();
  const cashRaw = String(formData.get("cashAccountNumber") ?? "").trim();
  const values = { salesAccountNumber: salesRaw, cashAccountNumber: cashRaw };
  const salesN = Number(salesRaw);
  const cashN = Number(cashRaw);
  if (!salesRaw || !Number.isInteger(salesN) || salesN <= 0) {
    return { error: "Angiv et gyldigt kontonummer (positivt heltal) til salgskontoen.", values };
  }
  if (!cashRaw || !Number.isInteger(cashN) || cashN <= 0) {
    return { error: "Angiv et gyldigt kontonummer (positivt heltal) til indbetalingskontoen.", values };
  }

  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) return { error: "Ingen virksomhed fundet.", values };

  const existing = await prisma.dineroConnection.findFirst({ where: { companyId: company.id }, select: { id: true } });
  const orgId = resolveOrgId();
  if (!existing && !orgId) return { error: "Test forbindelsen til Dinero først.", values };

  await prisma.dineroConnection.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, organizationId: orgId ?? "", salesAccountNumber: salesN, cashAccountNumber: cashN },
    update: { salesAccountNumber: salesN, cashAccountNumber: cashN },
  });
  revalidatePath("/accounting");
  return { ok: true };
}

/** "Test forbindelse" — fetch a client-credentials token, confirm the org is
 *  reachable, and cache org name/isPro/status. Returns the result for inline display. */
export async function runDineroTest(_prev: TestResult, _formData: FormData): Promise<TestResult> {
  void _prev; void _formData; // useActionState-signatur — argumenterne bruges ikke her
  await guardAction();
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, error: "Kun administratorer." };
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) return { ok: false, error: "Ingen virksomhed fundet." };
  const res = await testDineroConnection(company.id);
  revalidatePath("/accounting");
  return res;
}

/** "Fakturer nu" (Thomas, 2026-09-03) — fakturér ÉN ordre fra Klar til
 *  fakturering-listen på /fakturering med det samme. Genbruger den EKSISTERENDE
 *  pr.-ordre-Dinero-flow (issueInvoiceForOrder — samme kode som "Fakturér igen"
 *  på ordresiden og natautomatikken): idempotent, genoptager fra det nåede trin
 *  og KASTER ALDRIG — fejl returneres, så UI'et kan vise dem inline (aldrig
 *  stille). Kun administratorer (samme gate som RevenuePanel). */
export type InvoiceNowResult = { ok: boolean; message?: string; error?: string };

export async function invoiceNow(orderId: number): Promise<InvoiceNowResult> {
  await guardAction();
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, error: "Kun administratorer kan fakturere herfra." };
  try {
    const res = await issueInvoiceForOrder(orderId);
    if (!res.ok) return { ok: false, error: res.error ?? "Fakturering fejlede — intet blev sendt." };
    revalidatePath("/fakturering");
    const message =
      res.status === "Samlefaktura" ? "Ordet ligger på kundens samlefaktura (køres d. 20.)."
      : res.status === "none" ? "Ordet har valget \"Send ikke faktura\" — intet at fakturere."
      : res.status === "later" ? "Ordet er sat til \"Registreres senere\" — intet at fakturere."
      : res.status === "simulated" ? "Dinero er ikke konfigureret — faktureringen blev kun SIMULERET (dry-run)."
      : res.status === "Draft" ? "Kladde oprettet i Dinero (ikke bogført endnu)."
      : res.status === "Booked" ? "Faktura bogført i Dinero."
      : "Faktura sendt til kunden.";
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fakturering fejlede — intet blev sendt." };
  }
}

/** "Fakturér igen" — re-run invoicing for an order using its stored decision,
 *  resuming from the furthest Dinero state already reached. */
export async function retryInvoice(orderId: number): Promise<void> {
  await guardAction();
  await issueInvoiceForOrder(orderId);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}
