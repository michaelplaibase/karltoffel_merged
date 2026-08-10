// Erhvervs-samlefaktura (Michael, 2026-08-10, Slack #karltoffel-plaibase).
//
// Regel (bekræftet ordret): "Thomas og de andre trykker 'udført' eller 'done'
// i CRM. Det betyder, at alle opgaver i perioden 20.-19. i næste måned skal
// faktureres samlet til virksomheden. Det skal bare ske helt automatisk."
//
// - Trigger: en ordre står med status "Udført" (samme statusværdi som
//   completeOrder sætter — se app/actions/orders.ts, STATUS.udfoert).
// - Kontakt: KUN erhvervskunder (Contact.isCompany = true). Privatkunder
//   forbliver på den eksisterende pr.-ordre-fakturering (lib/dinero.ts,
//   issueInvoiceForOrder), uændret.
// - Periode: d. 20. i en måned til d. 19. i den NÆSTE måned (begge inkl.),
//   ikke kalendermåneden. Kørslen d. 20. samler den periode der lige er
//   afsluttet dagen før (i går var d. 19.).
// - Ingen godkendelse: der er INTET manuelt "godkend og send"-trin her —
//   automatisk draft → book → send, ligesom issueInvoiceForOrder gør for
//   private ordrer, blot med linjer fra FLERE ordrer på én faktura.
// - Idempotens: businessBatchInvoiceGuid sættes FØR bogføring (unik pr. ordre-
//   sæt via en periodenøgle beregnet on-the-fly — se findExistingBatchGuid),
//   så en gentaget/fejlslagen cron-kørsel ikke laver to fakturaer for samme
//   kunde+periode. dineroInvoiceGuid (@unique, pr.-ordre-feltet) bruges IKKE
//   her — det ville kollidere, fordi flere ordrer skal dele samme faktura-guid.
import { prisma } from "./db";
import {
  loadActiveConfig, getAccessToken, ensureDineroContact, createDraftInvoice,
  bookInvoice, emailInvoice, getInvoice, findInvoiceByExternalRef, DineroApiError,
} from "./dinero";

const BOOKED_STATES = new Set(["Booked", "Sent"]);

/** [start, end) for "d. 20. i forrige måned til d. 20. i denne måned" (UTC-dato,
 *  ingen klokkeslæt-afhængighed — ordrer er dato-baserede). `now` er typisk
 *  cron-kørselstidspunktet (d. 20.); perioden dækker altså i går (d. 19.)
 *  tilbage til d. 20. i MÅNEDEN FØR. */
export function billingPeriodEndingYesterday(now: Date): { start: Date; end: Date; label: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  // "end" er eksklusiv (d. 20. i denne måned) — dækker altså til og med d. 19.
  const end = new Date(Date.UTC(y, m, 20));
  const start = new Date(Date.UTC(y, m - 1, 20));
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  const lastDay = new Date(end.getTime() - 864e5);
  return { start, end, label: `${fmt(start)} til ${fmt(lastDay)}` };
}

const orderExtRefBatch = (contactId: number, periodStartISO: string) => `karltoffel-batch-${contactId}-${periodStartISO}`;

export type BatchResult = {
  companies: number;
  invoiced: number;
  simulated: number;
  failed: number;
  skippedNoOrders: number;
  errors: { contactId: number; error: string }[];
};

/**
 * Kør erhvervs-samlefakturering for perioden der sluttede i går. Grupperer
 * "Udført"-ordrer pr. erhvervskontakt, opretter/bogfører/afsender ÉN Dinero-
 * faktura pr. kontakt, helt automatisk. Kaldes fra app/api/business-invoicing/
 * route.ts (cron, d. 20. hver måned) — se vercel.json.
 */
export async function runBusinessBatchInvoicing(now: Date = new Date()): Promise<BatchResult> {
  const { start, end } = billingPeriodEndingYesterday(now);
  const periodStartISO = start.toISOString().slice(0, 10);

  // Kun erhvervskontakter, kun "Udført", kun ordrer der endnu ikke er lagt ind
  // i en samlefaktura (idempotens-værn ved gentaget kørsel/crash-recovery).
  const orders = await prisma.order.findMany({
    where: {
      status: "Udført",
      businessBatchInvoiceGuid: null,
      plannedAt: { gte: start, lt: end },
      contact: { isCompany: true },
    },
    include: { contact: true, tasks: true },
  });

  const result: BatchResult = { companies: 0, invoiced: 0, simulated: 0, failed: 0, skippedNoOrders: 0, errors: [] };
  if (!orders.length) return result;

  const byContact = new Map<number, typeof orders>();
  for (const o of orders) {
    const list = byContact.get(o.contactId) ?? [];
    list.push(o);
    byContact.set(o.contactId, list);
  }
  result.companies = byContact.size;

  const cfg = await loadActiveConfig();

  for (const [contactId, contactOrders] of byContact) {
    const sumInclVat = contactOrders.reduce((a, o) => a + o.tasks.reduce((b, t) => b + t.price, 0), 0);
    const ref = orderExtRefBatch(contactId, periodStartISO);
    const orderIds = contactOrders.map((o) => o.id);

    if (!cfg) {
      // Dry-run: log + marker ordrerne som "simulated", men lad IKKE-null guid
      // fra en tidligere rigtig kørsel blive overskrevet (samme værn som
      // issueInvoiceForOrder for pr.-ordre-fakturering).
      console.log(`[business-invoicing:dry-run] kontakt #${contactId} periode=${periodStartISO} ordrer=${orderIds.join(",")} sum=${sumInclVat}kr`);
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

      // Reuse an existing draft for this contact+period if a prior run got this
      // far but crashed before persisting the guid on every order row.
      let existing = await findInvoiceByExternalRef(access, org, ref);
      let guid = existing?.guid ?? null;
      let timeStamp = existing?.timeStamp ?? "";

      if (!guid) {
        const lines = contactOrders.flatMap((o) =>
          o.tasks.map((t) => ({ description: `Ordre #${o.id} — ${t.description}`, price: t.price })),
        );
        const draft = await createDraftInvoice(access, org, {
          contactGuid, orderId: 0, salesAccountNumber: cfg.salesAccountNumber, tasks: lines,
        });
        // createDraftInvoice sætter ExternalReference til "karltoffel-order-0" —
        // det er forkert for en samlefaktura, så vi retter den til batch-nøglen
        // med det samme (ellers matcher findInvoiceByExternalRef aldrig næste gang).
        guid = draft.guid;
        timeStamp = draft.timeStamp;
        await patchExternalReference(access, org, guid, timeStamp, ref).then((ts) => { timeStamp = ts; });
      }

      // Persist the shared guid on EVERY order in this batch — inside no explicit
      // transaction needed (each row is independent; a crash here just means the
      // next run re-adopts the same guid via findInvoiceByExternalRef above).
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { businessBatchInvoiceGuid: guid, businessBatchInvoiceTimeStamp: timeStamp, businessBatchInvoiceStatus: "Draft", businessBatchError: null },
      });

      const alreadyBooked = existing?.number != null;
      let bookedTotal = existing?.totalInclVat ?? null;
      if (!alreadyBooked) {
        const detail = await getInvoice(access, org, guid);
        if (detail.totalInclVat == null) throw new Error("Momskontrol umulig: Dinero returnerede ingen total — kladden er IKKE bogført.");
        if (Math.abs(detail.totalInclVat - sumInclVat) > 1) {
          throw new Error(`Momskontrol fejlede: Dinero-total ${detail.totalInclVat} kr ≠ ordrernes sum ${sumInclVat} kr. Kladden er IKKE bogført.`);
        }
        const booked = await bookInvoice(access, org, guid, detail.timeStamp || timeStamp);
        timeStamp = booked.timeStamp || timeStamp;
        bookedTotal = booked.totalInclVat ?? detail.totalInclVat;
        await prisma.order.updateMany({
          where: { id: { in: orderIds } },
          data: { businessBatchInvoiceNumber: booked.number, businessBatchInvoiceTimeStamp: timeStamp, businessBatchInvoiceStatus: "Booked" },
        });
      }

      // Automatisk afsendelse — INGEN godkendelsestrin (Michael: "Det skal bare
      // ske helt automatisk"). Samme non-downgrade-garanti som pr.-ordre-flowet.
      await emailInvoice(access, org, guid, timeStamp);
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { businessBatchInvoiceStatus: "Sent", businessBatchInvoicedAt: new Date(), businessBatchError: null },
      });
      result.invoiced++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : "Erhvervsfakturering fejlede").slice(0, 500);
      result.failed++;
      result.errors.push({ contactId, error: msg });
      await prisma.order.updateMany({
        where: { id: { in: orderIds }, businessBatchInvoiceNumber: null },
        data: { businessBatchError: msg, businessBatchInvoiceStatus: "Failed" },
      }).catch(() => {});
    }
  }

  return result;
}

/** Dinero har ingen "update ExternalReference" på en oprettet faktura via det
 *  offentlige felt-sæt createDraftInvoice bruger — vi patcher den derfor
 *  eksplicit lige efter oprettelse, ellers matcher idempotens-opslaget
 *  (findInvoiceByExternalRef) aldrig ved en efterfølgende kørsel. Returnerer
 *  det (evt. opdaterede) TimeStamp. Best-effort: fejler patchet, fortsætter vi
 *  alligevel — batchen bliver blot ikke idempotent-matchet ved en evt. genkørsel,
 *  hvilket kun betyder et ekstra dry-check, ikke en dobbelt-fakturering (guiden
 *  er allerede persisteret på ordrerne af kalderen). */
async function patchExternalReference(access: string, org: string, guid: string, timeStamp: string, ref: string): Promise<string> {
  try {
    const res = await fetch(`https://api.dinero.dk/v1/${org}/invoices/${guid}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}`, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ Timestamp: timeStamp, ExternalReference: ref }),
    });
    if (!res.ok) return timeStamp;
    const data = (await res.json().catch(() => ({}))) as { TimeStamp?: string };
    return data.TimeStamp ?? timeStamp;
  } catch {
    return timeStamp;
  }
}

// Re-export so callers only need this module for the batch flow (DineroApiError
// is used by callers wanting to distinguish Dinero HTTP errors from others).
export { DineroApiError };
