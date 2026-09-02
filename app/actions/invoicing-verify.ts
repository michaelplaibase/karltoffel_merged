"use server";

// Verificering af fakturaoverblikket (Michael, 2026-09-02): tjek alle ordrer i
// /fakturering op mod Dinero og synkronisér de lokale statusfelter med det,
// Dinero reelt har. Bruges til at fange afvigelser mellem CRM og Dinero — fx
// en faktura der blev sendt direkte i Dinero, eller en kladde der blev slettet.
import { prisma } from "@/lib/db";
import { guardAction, getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { loadActiveConfig, getAccessToken, getInvoice, findInvoiceByExternalRef } from "@/lib/dinero";

export type VerifyEntry = {
  orderId: number;
  localStatus: string | null;
  dineroStatus: string;      // kort tekst: hvad Dinero reelt har
  number: number | null;
  corrected: boolean;        // true hvis CRM-felterne blev opdateret
  error?: string;
};

export type VerifyResult = {
  ok: boolean;
  error?: string;
  checked: number;
  corrected: number;
  entries: VerifyEntry[];
};

export async function verifyInvoicing(): Promise<VerifyResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) return { ok: false, error: "Kun administratorer kan verificere mod Dinero.", checked: 0, corrected: 0, entries: [] };
  await guardAction();

  const cfg = await loadActiveConfig();
  if (!cfg) return { ok: false, error: "Dinero er ikke konfigureret (eller dry-run er slået til) — der er intet at verificere imod.", checked: 0, corrected: 0, entries: [] };

  const access = await getAccessToken();

  // Samme datomodel som /fakturering-siden: alle fortids-ordrer.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  today.setUTCDate(today.getUTCDate() + 1); // "i dag" må gerne med — en i dag udført ordre kan være faktureret
  const orders = await prisma.order.findMany({
    where: { plannedAt: { lt: today } },
    include: { contact: { select: { isCompany: true } } },
    orderBy: { id: "asc" },
  });

  const entries: VerifyEntry[] = [];
  let corrected = 0;

  for (const o of orders) {
    try {
      let dineroLabel = "Ingen faktura i Dinero";
      let dineroNumber: number | null = null;
      let update: Record<string, unknown> | null = null;

      if (o.businessBatchInvoiceGuid) {
        // Samlefaktura: hent den reelle faktura og map status.
        const inv = await getInvoice(access, cfg.orgId, o.businessBatchInvoiceGuid);
        dineroNumber = inv.number;
        // Dinero har ikke et "Sent"-flag i dette endpoint-output; Number != null betyder bogført.
        // CRM ved selv, om den er sendt (businessBatchInvoiceStatus), men tjek at den stadig findes.
        dineroLabel = inv.number != null ? `Bogført i Dinero (#${inv.number})` : "Kladde i Dinero";
        const local = o.businessBatchInvoiceStatus ?? "";
        const localSaysBooked = local === "Sent" || local === "Booked";
        if (inv.number == null && localSaysBooked) {
          // Dinero siger kladde, CRM siger sendt → ret CRM til Draft.
          update = { businessBatchInvoiceStatus: "Draft", businessBatchInvoiceNumber: null };
          dineroLabel = "Kladde i Dinero (CRM sagde sendt — rettet)";
        }
      } else if (o.dineroInvoiceGuid) {
        const inv = await getInvoice(access, cfg.orgId, o.dineroInvoiceGuid);
        dineroNumber = inv.number;
        dineroLabel = inv.number != null ? `Bogført i Dinero (#${inv.number})` : "Kladde i Dinero";
        const local = o.dineroInvoiceStatus ?? "";
        const localSaysBooked = local === "Sent" || local === "Booked" || local === "Paid";
        if (inv.number == null && localSaysBooked) {
          update = { dineroInvoiceStatus: "Draft" };
          dineroLabel = "Kladde i Dinero (CRM sagde sendt — rettet)";
        } else if (inv.number != null && !localSaysBooked) {
          // CRM siger kladde, men Dinero har bogført → adoptér nummeret.
          update = { dineroInvoiceStatus: "Booked", dineroInvoiceNumber: inv.number };
        } else if (inv.number != null && o.dineroInvoiceNumber !== inv.number) {
          update = { dineroInvoiceNumber: inv.number };
        }
      } else {
        // Ingen guid lokalt. Tjek om Dinero alligevel har en faktura med
        // ordrens external reference (fx oprettet manuelt i Dimeros UI).
        const ref = `karltoffel-order-${o.id}`;
        const found = await findInvoiceByExternalRef(access, cfg.orgId, ref);
        if (found) {
          dineroLabel = found.number != null ? `Bogført i Dinero (#${found.number})` : "Kladde i Dinero";
          update = {
            dineroInvoiceGuid: found.guid,
            dineroInvoiceTimeStamp: found.timeStamp,
            ...(found.number != null ? { dineroInvoiceStatus: "Booked", dineroInvoiceNumber: found.number } : { dineroInvoiceStatus: "Draft" }),
          };
        }
      }

      if (update) {
        await prisma.order.update({ where: { id: o.id }, data: update });
        corrected++;
      }
      entries.push({
        orderId: o.id,
        localStatus: o.dineroInvoiceStatus ?? o.businessBatchInvoiceStatus ?? null,
        dineroStatus: dineroLabel,
        number: dineroNumber,
        corrected: !!update,
      });
    } catch (e) {
      entries.push({
        orderId: o.id,
        localStatus: o.dineroInvoiceStatus ?? o.businessBatchInvoiceStatus ?? null,
        dineroStatus: "Kunne ikke hentes",
        number: null,
        corrected: false,
        error: (e instanceof Error ? e.message : "ukendt fejl").slice(0, 200),
      });
    }
  }

  revalidatePath("/fakturering");
  return { ok: true, checked: orders.length, corrected, entries };
}
