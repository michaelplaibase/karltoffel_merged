// "Fakturér alle" (Michael, 2026-09-03): manuel knap i Faktureringsoverblikket
// (/fakturering) der overrider ALLE tidsregler og sender fakturaer MED DET SAME
// — både for privat- og erhvervskunder, uanset faktureringsregel (pr_gang,
// maaned, kvartal). Normal-flowet (samlefaktura d. 20., pr.-gang kl. 23)
// påvirkes IKKE — denne knap er et manuelt "ryd l sagen nu"-tilskud.
//
// Design (genbruger samlefaktura-maskinens sikkerheds­værn):
// - Kandidater: fortidsordrer med status "Udført", endnu uden faktura
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
      plannedAt: { lt: today },
    },
    select: { id: true, invoiceDecision: true },
  });
  return rows.filter((o) => !o.invoiceDecision || !SKIP_DECISIONS.has(o.invoiceDecision)).map((o) => o.id);
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
      plannedAt: { lt: today },
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

  const cfg = await loadActiveConfig();
  const todayISO = todayCphISO();

  let first = true;
  for (const [contactId, contactOrders] of byContact) {
    // 300 ms pause mellem kunder (ikke før den første) — Dinero rate-limit.
    if (first) first = false; else await sleep(300);

    const sumInclVat = contactOrders.reduce((a, o) => a + o.tasks.reduce((b, t) => b + t.price, 0), 0);
    const customer = contactOrders[0].contact.name;
    const ref = `karltoffel-invoice-all-${contactId}-${todayISO}`;
    const orderIds = contactOrders.map((o) => o.id);

    if (!cfg) {
      // Dry-run: log + markér som simulated, nedgrader ALDRIG en rigtig faktura.
      console.log(`[invoice-all:dry-run] kontakt #${contactId} (${customer}) ordrer=${orderIds.join(",")} sum=${sumInclVat}kr`);
      await prisma.order.updateMany({
        where: { id: { in: orderIds }, businessBatchInvoiceGuid: null },
        data: { businessBatchInvoiceStatus: "simulated", businessBatchInvoicedAt: new Date(), businessBatchError: null },
      });
      result.simulated++;
      continue;
    }

    try {
      const access = await getAccessToken();
      const org = cfg.orgId;
      const contact = contactOrders[0].contact;

      let contactGuid = contact.dineroContactGuid;
      if (!contactGuid) {
        contactGuid = await ensureDineroContact(access, org, contact);
        const clash = await prisma.contact.findFirst({ where: { dineroContactGuid: contactGuid, NOT: { id: contactId } }, select: { id: true } });
        if (!clash) await prisma.contact.update({ where: { id: contactId }, data: { dineroContactGuid: contactGuid } });
      }

      // Genbrug en eksisterende kladde for denne kunde+dagsnøgle, hvis et tidligt
      // forsøg døde før guid-persist (samme idempotens som samlefaktura-flowet).
      const existing = await findInvoiceByExternalRef(access, org, ref);
      let guid = existing?.guid ?? null;
      let timeStamp = existing?.timeStamp ?? "";

      if (!guid) {
        const lines = contactOrders.flatMap((o) =>
          o.tasks.map((t) => ({ description: `Ordre #${o.id} — ${t.description}`, price: t.price })),
        );
        const draft = await createDraftInvoice(access, org, {
          contactGuid, orderId: 0, salesAccountNumber: cfg.salesAccountNumber, tasks: lines,
        });
        guid = draft.guid;
        timeStamp = draft.timeStamp;
        // Ret ExternalReference fra "karltoffel-order-0" til dagsnøglen (ellers
        // matcher genkørsels-opslaget aldrig) — best-effort, som i batch-flowet.
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
      }

      // Persister guid på ALLE ordrer i gruppen FØR bogføring (crash-sikkerhed).
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { businessBatchInvoiceGuid: guid, businessBatchInvoiceTimeStamp: timeStamp, businessBatchInvoiceStatus: "Draft", businessBatchError: null },
      });

      const alreadyBooked = existing?.number != null;
      if (!alreadyBooked) {
        const detail = await getInvoiceWithRetry(access, org, guid);
        if (detail.totalInclVat == null) throw new Error("Momskontrol umulig: Dinero returnerede ingen total — kladden er IKKE bogført.");
        if (Math.abs(detail.totalInclVat - sumInclVat) > 1) {
          throw new Error(`Momskontrol fejlede: Dinero-total ${detail.totalInclVat} kr ≠ ordrernes sum ${sumInclVat} kr. Kladden er IKKE bogført.`);
        }
        const booked = await bookInvoice(access, org, guid, detail.timeStamp || timeStamp);
        timeStamp = booked.timeStamp || timeStamp;
        await prisma.order.updateMany({
          where: { id: { in: orderIds } },
          data: { businessBatchInvoiceNumber: booked.number, businessBatchInvoiceTimeStamp: timeStamp, businessBatchInvoiceStatus: "Booked" },
        });
      }

      await emailInvoice(access, org, guid, timeStamp);
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { businessBatchInvoiceStatus: "Sent", businessBatchInvoicedAt: new Date(), businessBatchError: null },
      });
      result.invoiced++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : "Fakturering fejlede").slice(0, 500);
      result.failed++;
      result.errors.push({ contactId, customer, error: msg });
      await prisma.order.updateMany({
        where: { id: { in: orderIds }, businessBatchInvoiceNumber: null },
        data: { businessBatchError: msg, businessBatchInvoiceStatus: "Failed" },
      }).catch(() => {});
    }
  }

  result.ok = result.failed === 0;
  return result;
}
