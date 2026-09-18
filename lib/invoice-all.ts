// "Fakturér alle" (Michael, 2026-09-03) & "Fakturér kunde" (Thomas, 2026-09-17):
// Sender fakturaer MED DET SAMME — både for privat- og erhvervskunder, uanset
// faktureringsregel (pr_gang, maaned, kvartal).
// Hver kunde samles ALTID på ÉN faktura for alle deres uafregnede udførte opgaver.
// Normal-flowet (samlefaktura d. 20., pr.-gang kl. 23) påvirkes IKKE — dette
// er et manuelt overbliks- og handlingsflow på /fakturering.
//
// Design (genbruger samlefaktura-maskinens sikkerhedsværn):
// - Kandidater: fortidsordrer med status "Udført", endnu uden bogført faktura
//   (hverken pr.-ordre-guid eller batch-guid) — samme synlighed som
//   "Klar til fakturering"-kortet på /fakturering. Ordrer med en eksplicit
//   "Send ikke faktura"/"Registrer senere"-beslutning respekteres og springes over.
// - Grupperes pr. kontakt → ÉN Dinero-faktura pr. kunde med alle ordrelinjer
//   (samme mønster som lib/business-invoicing.ts: draft → momskontrol → book →
//   email). Idempotent via ExternalReference-nøgle + guid persisteret FØR
//   bogføring, så en gentaget tryk/crash aldrig dobbeltfakturerer.
// - Batch-felterne (businessBatchInvoice*) genbruges, fordi dineroInvoiceGuid
//   er @unique pr. ordre og ikke kan deles af flere ordrer på én faktura.
// - Dinero rate-limiter hurtige sekventielle kald → 300 ms pause mellem kunder
//   og 429-backoff (samme mønster som app/actions/invoicing-verify.ts).
import { prisma } from "./db";
import {
  loadActiveConfig, getAccessToken, ensureDineroContact, createDraftInvoice,
  bookInvoice, emailInvoice, getInvoice, findInvoiceByExternalRef, DineroApiError,
} from "./dinero";
import { todayCphISO } from "./calendar";
import { findOpenDraftForContact, addProductLinesToDraft, registerOpenInvoice, releaseOpenInvoice } from "./invoice-consolidation";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET med 429-backoff (Dinero rate-limiter hurtige kald). */
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

/** Beslutninger der betyder "der SKAL ikke sendes faktura" — respekteres altid. */
const SKIP_DECISIONS = new Set([
  "Send ikke faktura fra Karltoffel",
  "Registrer på et senere tidspunkt",
]);

export type InvoiceAllResult = {
  ok: boolean;
  contacts: number;          // antal kunder der fik (eller ville få) en faktura
  invoiced: number;          // oprettet + bogført + sendt
  simulated: number;         // dry-run (Dinero ikke konfigureret)
  skippedNoDecision: number; // ordrer sprunget over pga. eksplicit nej-tak-beslutning
  failed: number;
  totalInclVat: number;
  errors: { contactId: number; customer: string; error: string }[];
};

/** Ordre-id'er der er klar til "Fakturér alle": Udført, fortid, ingen faktura,
 *  og ikke en eksplicit "ingen faktura"-beslutning. Bruges både af knappen
 *  (til optælling/preview) og af selve kørslen. */
export async function readyOrderIds(): Promise<number[]> {
  const today = new Date(`${todayCphISO()}T00:00:00.000Z`);
  const rows = await prisma.order.findMany({
    where: {
      status: "Udført",
      businessBatchInvoiceGuid: null,
      dineroInvoiceGuid: null,
      dineroInvoiceNumber: null,
      plannedAt: { lte: today },
    },
    select: { id: true, invoiceDecision: true },
  });
  return rows.filter((o) => !o.invoiceDecision || !SKIP_DECISIONS.has(o.invoiceDecision)).map((o) => o.id);
}

/** Fakturér én enkelt kunde og alle kundens uafregnede udførte opgaver på ÉN samlet faktura. */
export async function invoiceSingleCustomer(contactId: number): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  simulated?: boolean;
}> {
  const today = new Date(`${todayCphISO()}T00:00:00.000Z`);
  const todayISO = todayCphISO();
  const ref = `karltoffel-customer-${contactId}-${todayISO}`;

  // Find alle kandidat-ordrer for kunden der er Udført, fortid og endnu ikke bogført/sendt
  const allPast = await prisma.order.findMany({
    where: {
      contactId,
      status: "Udført",
      plannedAt: { lte: today },
      dineroInvoiceGuid: null,
      dineroInvoiceNumber: null,
      businessBatchInvoiceNumber: null,
    },
    include: { contact: true, tasks: true },
    orderBy: { plannedAt: "asc" },
  });

  // Udeluk ordrer med eksplicit nej-tak-beslutning
  const contactOrders = allPast.filter((o) => !o.invoiceDecision || !SKIP_DECISIONS.has(o.invoiceDecision));

  // Tjek om kunden allerede har en åben faktura / kladde i CRM
  const openInvoice = await prisma.openInvoice.findUnique({
    where: { contactId },
    include: { manualLines: true, contact: true },
  });

  const manualLines = openInvoice?.manualLines ?? [];
  const manualSum = manualLines.reduce((a, l) => a + Number(l.quantity) * l.priceInclVat, 0);
  const ordersSum = contactOrders.reduce((a, o) => a + o.tasks.reduce((b, t) => b + t.price, 0), 0);
  const sumInclVat = ordersSum + manualSum;

  if (contactOrders.length === 0 && manualLines.length === 0) {
    return { ok: false, error: "Ingen opgaver eller linjer at fakturere for denne kunde." };
  }

  const orderIds = contactOrders.map((o) => o.id);
  const customer = contactOrders[0]?.contact.name ?? openInvoice?.contact.name ?? "Kunden";
  const cfg = await loadActiveConfig();

  if (!cfg) {
    // Dry-run: log + markér som simulated, nedgrader ALDRIG en rigtig faktura.
    console.log(`[invoice-customer:dry-run] kontakt #${contactId} (${customer}) ordrer=${orderIds.join(",")} sum=${sumInclVat}kr`);
    if (orderIds.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds }, businessBatchInvoiceNumber: null },
        data: { businessBatchInvoiceStatus: "simulated", businessBatchInvoicedAt: new Date(), businessBatchError: null },
      });
    }
    if (openInvoice) {
      await prisma.openInvoice.deleteMany({ where: { contactId, guid: openInvoice.guid } }).catch(() => {});
    }
    return {
      ok: true,
      simulated: true,
      message: `Simuleret (dry-run): ${orderIds.length} opgave(r) på ${customer} (${sumInclVat.toLocaleString("da-DK")} kr.) faktureret samlet.`,
    };
  }

  try {
    const access = await getAccessToken();
    const org = cfg.orgId;
    const contact = contactOrders[0]?.contact ?? (await prisma.contact.findUniqueOrThrow({ where: { id: contactId } }));

    let contactGuid = contact.dineroContactGuid;
    if (!contactGuid) {
      contactGuid = await ensureDineroContact(access, org, contact);
      const clash = await prisma.contact.findFirst({ where: { dineroContactGuid: contactGuid, NOT: { id: contactId } }, select: { id: true } });
      if (!clash) await prisma.contact.update({ where: { id: contactId }, data: { dineroContactGuid: contactGuid } });
    }

    const existing = await findInvoiceByExternalRef(access, org, ref);
    let guid = existing?.guid ?? null;
    let timeStamp = existing?.timeStamp ?? "";

    // KONSOLIDERING (2026-09-15): en kunde skal kun have ÉN åben faktura.
    // Har kunden en åben kladde, tilføjes ordrelinjerne DEN i stedet for at
    // oprette en ny — og hele den åbne faktura bogføres+sendes samlet.
    let adoptedTotalInclVat: number | null = null;
    if (!guid) {
      const open = await findOpenDraftForContact(access, org, contactId);
      if (open) {
        guid = open.guid;
        timeStamp = open.timeStamp;
        adoptedTotalInclVat = open.totalInclVat;
        // Tilføj kun linjer for ordrer der ikke allerede bærer denne guid
        const ordersToAdd = contactOrders.filter((o) => o.businessBatchInvoiceGuid !== guid);
        if (ordersToAdd.length > 0) {
          const lines = ordersToAdd.flatMap((o) =>
            o.tasks.map((t) => ({ description: `Ordre #${o.id} — ${t.description}`, price: t.price })),
          );
          await addProductLinesToDraft(access, org, guid, lines, cfg.salesAccountNumber);
        }
      }
    }

    if (!guid) {
      const lines = contactOrders.flatMap((o) =>
        o.tasks.map((t) => ({ description: `Ordre #${o.id} — ${t.description}`, price: t.price })),
      );
      const draft = await createDraftInvoice(access, org, {
        contactGuid, orderId: contactOrders[0]?.id ?? 0, salesAccountNumber: cfg.salesAccountNumber, tasks: lines,
      });
      guid = draft.guid;
      timeStamp = draft.timeStamp;
      try {
        const res = await fetch(`https://api.dinero.dk/v1/${org}/invoices/${guid}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${access}`, accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ Timestamp: timeStamp, ExternalReference: ref }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { TimeStamp?: string };
          timeStamp = data.TimeStamp ?? timeStamp;
        }
      } catch { /* best-effort */ }
      await registerOpenInvoice(contactId, guid).catch(() => {});
    }

    // Persister guid på ALLE ordrer i gruppen FØR bogføring (crash-sikkerhed).
    if (orderIds.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { businessBatchInvoiceGuid: guid, businessBatchInvoiceTimeStamp: timeStamp, businessBatchInvoiceStatus: "Draft", businessBatchError: null },
      });
    }

    const alreadyBooked = existing?.number != null;
    let bookedNumber = existing?.number ?? null;

    if (!alreadyBooked) {
      const detail = await getInvoiceWithRetry(access, org, guid);
      if (detail.totalInclVat == null) throw new Error("Momskontrol umulig: Dinero returnerede ingen total — kladden er IKKE bogført.");
      const expected = (adoptedTotalInclVat ?? 0) + (contactOrders.filter((o) => o.businessBatchInvoiceGuid !== guid).reduce((a, o) => a + o.tasks.reduce((b, t) => b + t.price, 0), 0) || sumInclVat);
      if (Math.abs(detail.totalInclVat - expected) > 1) {
        throw new Error(`Momskontrol fejlede: Dinero-total ${detail.totalInclVat} kr ≠ forventet ${expected} kr. Kladden er IKKE bogført.`);
      }
      const booked = await bookInvoice(access, org, guid, detail.timeStamp || timeStamp);
      timeStamp = booked.timeStamp || timeStamp;
      bookedNumber = booked.number;
      if (orderIds.length > 0) {
        await prisma.order.updateMany({
          where: { id: { in: orderIds } },
          data: { businessBatchInvoiceNumber: booked.number, businessBatchInvoiceTimeStamp: timeStamp, businessBatchInvoiceStatus: "Booked" },
        });
      }
    }

    await emailInvoice(access, org, guid, timeStamp);
    // Sendt/bogført → fakturaen er ikke længere åben (konsoliderings-nøglen).
    await releaseOpenInvoice(contactId, guid);
    if (orderIds.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { businessBatchInvoiceStatus: "Sent", businessBatchInvoicedAt: new Date(), businessBatchError: null },
      });
    }

    return {
      ok: true,
      message: `Faktura #${bookedNumber ?? ""} sendt til ${customer} (${orderIds.length} opgave(r) samlet, ${sumInclVat.toLocaleString("da-DK")} kr.).`,
    };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : "Fakturering fejlede").slice(0, 500);
    if (orderIds.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds }, businessBatchInvoiceNumber: null },
        data: { businessBatchError: msg, businessBatchInvoiceStatus: "Failed" },
      }).catch(() => {});
    }
    return { ok: false, error: msg };
  }
}

/** Kør "Fakturér alle": grupper alle klare ordrer pr. kontakt og send ÉN
 *  faktura pr. kunde med det samme. Kaldes kun fra app/actions/invoice-all.ts
 *  (admin-beskyttet server action). */
export async function runInvoiceAll(): Promise<InvoiceAllResult> {
  const result: InvoiceAllResult = {
    ok: true, contacts: 0, invoiced: 0, simulated: 0, skippedNoDecision: 0,
    failed: 0, totalInclVat: 0, errors: [],
  };

  const today = new Date(`${todayCphISO()}T00:00:00.000Z`);
  const allPast = await prisma.order.findMany({
    where: {
      status: "Udført",
      businessBatchInvoiceGuid: null,
      dineroInvoiceGuid: null,
      dineroInvoiceNumber: null,
      plannedAt: { lte: today },
    },
    include: { contact: true, tasks: true },
  });

  // Eksplicitte nej-tak-beslutninger tælles, men faktureres aldrig.
  const skipped = allPast.filter((o) => o.invoiceDecision && SKIP_DECISIONS.has(o.invoiceDecision));
  result.skippedNoDecision = skipped.length;

  const orders = allPast.filter((o) => !o.invoiceDecision || !SKIP_DECISIONS.has(o.invoiceDecision));
  if (!orders.length) return result;

  const byContact = new Map<number, typeof orders>();
  for (const o of orders) {
    const list = byContact.get(o.contactId) ?? [];
    list.push(o);
    byContact.set(o.contactId, list);
  }
  result.contacts = byContact.size;
  result.totalInclVat = orders.reduce((a, o) => a + o.tasks.reduce((b, t) => b + t.price, 0), 0);

  let first = true;
  for (const [contactId, contactOrders] of byContact) {
    // 300 ms pause mellem kunder (ikke før den første) — Dinero rate-limit.
    if (first) first = false; else await sleep(300);

    const customer = contactOrders[0].contact.name;
    const res = await invoiceSingleCustomer(contactId);

    if (res.ok) {
      if (res.simulated) {
        result.simulated++;
      } else {
        result.invoiced++;
      }
    } else {
      result.failed++;
      result.errors.push({ contactId, customer, error: res.error ?? "Fakturering fejlede" });
    }
  }

  result.ok = result.failed === 0;
  return result;
}
