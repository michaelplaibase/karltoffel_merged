"use server";

// "Fakturér alle" (Michael, 2026-09-03): server action bag knappen i
// Faktureringsoverblikket. Overrider alle tidsregler — sender nu.
// ADMIN-only: virksomhedsbred udsendelse af rigtige fakturaer (samme
// adgangsniveau som /api/business-invoicing), aldrig en almindelig medarbejder.
import { guardAdminAction, getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { runInvoiceAll, readyOrderIds, type InvoiceAllResult } from "@/lib/invoice-all";

export type InvoiceAllState = InvoiceAllResult & { forbidden?: boolean; empty?: boolean };

/** Optælling til bekræftelses-dialogen: hvor mange ordrer/kunder venter. */
export async function countReady(): Promise<{ orders: number; contacts: number }> {
  await getSessionUser(); // skal være logget ind; detaljeret admin-tjek sker i selve handlingen
  const ids = await readyOrderIds();
  // Antal kunder findes billigt via en dedikeret gruppe-tælleforespørgsel.
  const { prisma } = await import("@/lib/db");
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}T00:00:00.000Z`);
  const distinct = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: { contactId: true },
    distinct: ["contactId"],
  });
  void today;
  return { orders: ids.length, contacts: distinct.length };
}

export async function invoiceAll(_prev: InvoiceAllState, _formData: FormData): Promise<InvoiceAllState> {
  void _prev; void _formData;
  await guardAdminAction();

  const res = await runInvoiceAll();
  if (res.contacts === 0 && res.simulated === 0 && res.invoiced === 0) {
    return { ...res, empty: true };
  }
  revalidatePath("/fakturering");
  revalidatePath("/orders");
  return res;
}
