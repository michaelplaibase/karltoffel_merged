"use server";

// Server actions for the Dinero (Visma) accounting integration: disconnect,
// edit the chart-of-accounts numbers, and (re)issue an order's invoice. The OAuth
// connect + callback are route handlers (app/api/dinero/*), not actions, because
// Visma form_post's the authorization code cross-site.
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { getSessionUser } from "@/lib/api-auth";
import { issueInvoiceForOrder } from "@/lib/dinero";
import { revalidatePath } from "next/cache";

export type AccountsState = { error?: string; ok?: boolean };

/** Update the sales/cash Dinero chart-of-accounts numbers (admin only). */
export async function saveDineroAccounts(_prev: AccountsState, formData: FormData): Promise<AccountsState> {
  await guardAction();
  const user = await getSessionUser();
  if (!user?.isAdmin) return { error: "Kun administratorer kan ændre regnskabsindstillinger." };

  const sales = Number(formData.get("salesAccountNumber"));
  const cash = Number(formData.get("cashAccountNumber"));
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) return { error: "Ingen virksomhed fundet." };

  const updated = await prisma.dineroConnection.updateMany({
    where: { companyId: company.id },
    data: {
      salesAccountNumber: Number.isFinite(sales) && sales > 0 ? Math.trunc(sales) : 1000,
      cashAccountNumber: Number.isFinite(cash) && cash > 0 ? Math.trunc(cash) : 55040,
    },
  });
  if (!updated.count) return { error: "Ingen Dinero-forbindelse at opdatere. Forbind til Dinero først." };
  revalidatePath("/accounting");
  return { ok: true };
}

/** Remove the Dinero connection (admin only). Tokens are simply dropped. */
export async function disconnectDinero(): Promise<void> {
  await guardAction();
  const user = await getSessionUser();
  if (!user?.isAdmin) return;
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (company) await prisma.dineroConnection.deleteMany({ where: { companyId: company.id } });
  revalidatePath("/accounting");
}

/** "Fakturér igen" — re-run invoicing for an order using its stored decision,
 *  resuming from the furthest Dinero state already reached. */
export async function retryInvoice(orderId: number): Promise<void> {
  await guardAction();
  await issueInvoiceForOrder(orderId);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}
