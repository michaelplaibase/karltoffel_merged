"use server";

// Manuel fakturalinje på en ÅBEN faktura (2026-09-15): fx et varekøb kunden
// skal betale, tastes med beskrivelse + beløb (inkl. moms) + antal og lægges
// ind på kundens eksisterende åbne faktura — samme faktura som ellers sendes
// på kundens faktureringsdag. Kun muligt så længe fakturaen er en kladde.
import { guardAction } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { loadActiveConfig, getAccessToken, getInvoice } from "@/lib/dinero";
import { addProductLinesToDraft } from "@/lib/invoice-consolidation";

export type ManualLineResult = { ok: boolean; message?: string; error?: string };

export async function addManualInvoiceLine(
  openInvoiceId: number,
  description: string,
  priceInclKr: number,
  quantity: number,
): Promise<ManualLineResult> {
  await guardAction();
  const desc = description.trim();
  if (!desc) return { ok: false, error: "Beskrivelse mangler." };
  if (!Number.isFinite(priceInclKr) || priceInclKr <= 0) return { ok: false, error: "Beløb skal være et positivt tal." };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "Antal skal være et positivt tal." };

  const open = await prisma.openInvoice.findUnique({
    where: { id: openInvoiceId },
    include: { contact: true },
  });
  if (!open) return { ok: false, error: "Den åbne faktura findes ikke længere — den er måske allerede sendt." };

  const price = Math.round(priceInclKr); // kr INCL. moms pr. stk — samme konvention som TaskLine.price
  const qty = Math.round(quantity * 100) / 100;

  const cfg = await loadActiveConfig();
  if (!cfg) {
    // Dry-run (Dinero ikke konfigureret / DINERO_DRY_RUN=1): registrér linjen i
    // CRM så den er synlig, men rør ALDRIG en rigtig faktura.
    await prisma.invoiceManualLine.create({
      data: { openInvoiceId: open.id, guid: open.guid, description: desc, quantity: qty, priceInclVat: price },
    });
    revalidatePath("/fakturering");
    return { ok: true, message: "Simuleret (dry-run): linjen er registreret i CRM men IKKE tilføjet Dinero." };
  }

  try {
    const access = await getAccessToken();
    const org = cfg.orgId;
    // Fail-closed: fakturaen skal stadig være en kladde i Dinero — en bogført
    // faktura må aldrig ændres.
    const detail = await getInvoice(access, org, open.guid);
    if (detail.number != null) {
      return { ok: false, error: "Fakturaen er allerede bogført i Dinero og kan ikke ændres." };
    }
    await addProductLinesToDraft(access, org, open.guid, [{ description: desc, price, quantity: qty }], cfg.salesAccountNumber);
    await prisma.invoiceManualLine.create({
      data: { openInvoiceId: open.id, guid: open.guid, description: desc, quantity: qty, priceInclVat: price },
    });
    revalidatePath("/fakturering");
    return { ok: true, message: `Linjen er tilføjet ${open.contact.name}s åbne faktura.` };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : "Kunne ikke tilføje linjen").slice(0, 300) };
  }
}
