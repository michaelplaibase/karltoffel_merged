"use server";

// Manuel fakturalinje på en ÅBEN faktura eller kunde (2026-09-15 / 2026-09-17): fx et varekøb kunden
// skal betale, tastes med beskrivelse + beløb (inkl. moms) + antal og lægges
// ind på kundens eksisterende eller nye åbne faktura — samme faktura som ellers sendes
// på kundens faktureringsdag. Kun muligt så længe fakturaen er en kladde.
import { guardAction } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { loadActiveConfig, getAccessToken, getInvoice, ensureDineroContact, createDraftInvoice } from "@/lib/dinero";
import { addProductLinesToDraft, registerOpenInvoice } from "@/lib/invoice-consolidation";

export type ManualLineResult = { ok: boolean; message?: string; error?: string };

export async function addManualInvoiceLine(
  target: number | { openInvoiceId?: number; contactId?: number },
  description: string,
  priceInclKr: number,
  quantity: number,
): Promise<ManualLineResult> {
  await guardAction();
  const desc = description.trim();
  if (!desc) return { ok: false, error: "Beskrivelse mangler." };
  if (!Number.isFinite(priceInclKr) || priceInclKr <= 0) return { ok: false, error: "Beløb skal være et positivt tal." };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "Antal skal være et positivt tal." };

  let openInvoiceId: number | undefined;
  let contactId: number | undefined;

  if (typeof target === "object" && target !== null) {
    openInvoiceId = target.openInvoiceId;
    contactId = target.contactId;
  } else if (typeof target === "number") {
    const maybeOpen = await prisma.openInvoice.findUnique({ where: { id: target } });
    if (maybeOpen) {
      openInvoiceId = maybeOpen.id;
    } else {
      contactId = target;
    }
  }

  let open = openInvoiceId
    ? await prisma.openInvoice.findUnique({
        where: { id: openInvoiceId },
        include: { contact: { select: { id: true, name: true, dineroContactGuid: true } } },
      })
    : null;

  if (!open && contactId) {
    open = await prisma.openInvoice.findUnique({
      where: { contactId },
      include: { contact: { select: { id: true, name: true, dineroContactGuid: true } } },
    });
  }

  const price = Math.round(priceInclKr); // kr INCL. moms pr. stk — samme konvention som TaskLine.price
  const qty = Math.round(quantity * 100) / 100;
  const cfg = await loadActiveConfig();

  // Hvis kunden endnu ikke har en OpenInvoice i DB, opretter vi den automatisk nu
  if (!open && contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) return { ok: false, error: "Kunde ikke fundet." };

    if (!cfg) {
      // Dry-run
      const simGuid = `simulated-open-${contactId}-${Date.now()}`;
      open = await prisma.openInvoice.create({
        data: { contactId, guid: simGuid, status: "Draft" },
        include: { contact: { select: { id: true, name: true, dineroContactGuid: true } } },
      });
      await prisma.invoiceManualLine.create({
        data: { openInvoiceId: open.id, guid: open.guid, description: desc, quantity: qty, priceInclVat: price },
      });
      revalidatePath("/fakturering");
      return { ok: true, message: `Simuleret (dry-run): linjen er registreret i CRM for ${open.contact.name}.` };
    } else {
      try {
        const access = await getAccessToken();
        const org = cfg.orgId;
        let contactGuid = contact.dineroContactGuid;
        if (!contactGuid) {
          contactGuid = await ensureDineroContact(access, org, contact);
          const clash = await prisma.contact.findFirst({ where: { dineroContactGuid: contactGuid, NOT: { id: contactId } }, select: { id: true } });
          if (!clash) await prisma.contact.update({ where: { id: contactId }, data: { dineroContactGuid: contactGuid } });
        }
        const draft = await createDraftInvoice(access, org, {
          contactGuid,
          orderId: 0,
          salesAccountNumber: cfg.salesAccountNumber,
          tasks: [{ description: desc, price }],
        });
        await registerOpenInvoice(contactId, draft.guid);
        open = await prisma.openInvoice.findUniqueOrThrow({
          where: { contactId },
          include: { contact: { select: { id: true, name: true, dineroContactGuid: true } } },
        });
        await prisma.invoiceManualLine.create({
          data: { openInvoiceId: open.id, guid: open.guid, description: desc, quantity: qty, priceInclVat: price },
        });
        revalidatePath("/fakturering");
        return { ok: true, message: `Linjen er tilføjet ${open.contact.name}s åbne faktura.` };
      } catch (e) {
        return { ok: false, error: (e instanceof Error ? e.message : "Kunne ikke oprette kladden").slice(0, 300) };
      }
    }
  }

  if (!open) return { ok: false, error: "Den åbne faktura findes ikke længere — den er måske allerede sendt." };

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
