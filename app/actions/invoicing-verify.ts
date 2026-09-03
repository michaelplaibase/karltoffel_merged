"use server";

// Verificering af fakturaoverblikket (Michael, 2026-09-02): tjek alle ordrer i
// /fakturering op mod Dinero og synkronisér de lokale statusfelter med det,
// Dinero reelt har. V2: dynamisk throttling — Dinero 429'er ved sekventielle
// kald, så hver kald venter 300 ms og 429 retries op til 4 gange med backoff
// (i alt ~140 ordrer tager ~2-3 min; serverless timeout håndteres af at
// fortsætte ved næste tryk, da hver rettelse gemmes med det samme).
import { prisma } from "@/lib/db";
import { guardAction, getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { loadActiveConfig, getAccessToken, getInvoice, findInvoiceByExternalRef, DineroApiError } from "@/lib/dinero";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET med 429-backoff: Dinero rate-limiter hurtige sekventielle kald. */
async function getInvoiceWithRetry(access: string, org: string, guid: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getInvoice(access, org, guid);
    } catch (e) {
      if (e instanceof DineroApiError && e.status === 429 && attempt < 4) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

async function findInvoiceWithRetry(access: string, org: string, ref: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await findInvoiceByExternalRef(access, org, ref);
    } catch (e) {
      if (e instanceof DineroApiError && e.status === 429 && attempt < 4) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

export type VerifyEntry = {
  orderId: number;
  localStatus: string | null;
  dineroStatus: string;
  number: number | null;
  corrected: boolean;
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

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  today.setUTCDate(today.getUTCDate() + 1);
  const orders = await prisma.order.findMany({
    where: { plannedAt: { lt: today } },
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
        const inv = await getInvoiceWithRetry(access, cfg.orgId, o.businessBatchInvoiceGuid);
        dineroNumber = inv.number;
        dineroLabel = inv.number != null ? `Bogført i Dinero (#${inv.number})` : "Kladde i Dinero";
        const local = o.businessBatchInvoiceStatus ?? "";
        const localSaysBooked = local === "Sent" || local === "Booked";
        if (inv.number == null && localSaysBooked) {
          update = { businessBatchInvoiceStatus: "Draft", businessBatchInvoiceNumber: null };
          dineroLabel = "Kladde i Dinero (CRM sagde sendt — rettet)";
        }
      } else if (o.dineroInvoiceGuid) {
        const inv = await getInvoiceWithRetry(access, cfg.orgId, o.dineroInvoiceGuid);
        dineroNumber = inv.number;
        dineroLabel = inv.number != null ? `Bogført i Dinero (#${inv.number})` : "Kladde i Dinero";
        const local = o.dineroInvoiceStatus ?? "";
        const localSaysBooked = local === "Sent" || local === "Booked" || local === "Paid";
        if (inv.number == null && localSaysBooked) {
          update = { dineroInvoiceStatus: "Draft" };
          dineroLabel = "Kladde i Dinero (CRM sagde sendt — rettet)";
        } else if (inv.number != null && !localSaysBooked) {
          update = { dineroInvoiceStatus: "Booked", dineroInvoiceNumber: inv.number };
        } else if (inv.number != null && o.dineroInvoiceNumber !== inv.number) {
          update = { dineroInvoiceNumber: inv.number };
        }
      } else {
        const ref = `karltoffel-order-${o.id}`;
        const found = await findInvoiceWithRetry(access, cfg.orgId, ref);
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
      // Rolig pacing mellem ordrer — holder os under Dimeros rate limit.
      await sleep(300);
    } catch (e) {
      const is429 = e instanceof DineroApiError && e.status === 429;
      entries.push({
        orderId: o.id,
        localStatus: o.dineroInvoiceStatus ?? o.businessBatchInvoiceStatus ?? null,
        dineroStatus: is429 ? "Dinero sputtede (429) — prøv igen" : "Kunne ikke hentes",
        number: null,
        corrected: false,
        error: is429 ? undefined : (e instanceof Error ? e.message : "ukendt fejl").slice(0, 200),
      });
      if (is429) await sleep(2000);
    }
  }

  revalidatePath("/fakturering");
  return { ok: true, checked: orders.length, corrected, entries };
}
