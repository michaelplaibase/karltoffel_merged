import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { routeId } from "@/lib/route-ids";
import { deleteOrder } from "@/app/actions/orders";
import { retryInvoice } from "@/app/actions/dinero";
import { CatChip, MapLink, StatusPill, money } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";

export const metadata = { title: "Rediger ordre · Karltoffel" };

// dineroInvoiceStatus → Danish label + colour for the Fakturering card.
const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  simulated: { label: "Simuleret (dry-run — intet sendt til Dinero)", color: "#6b7280" },
  Draft: { label: "Kladde oprettet i Dinero", color: "#8a6d3b" },
  Booked: { label: "Bogført i Dinero", color: "#2e7d32" },
  Sent: { label: "Faktura sendt af Dinero", color: "#2e7d32" },
  Paid: { label: "Bogført + betalt (kontant)", color: "#2e7d32" },
  Failed: { label: "Fakturering fejlede", color: "#C4183C" },
  Samlefaktura: { label: "Faktureres på månedlig samlefaktura (erhverv)", color: "#8a6d3b" },
};

// businessBatchInvoiceStatus → dansk label for samlefaktura-sektionen (samme
// statusværdier som pr.-ordre-flowet, se lib/business-invoicing.ts).
const BATCH_STATUS: Record<string, { label: string; color: string }> = {
  simulated: { label: "Simuleret (dry-run — intet sendt til Dinero)", color: "#6b7280" },
  Draft: { label: "Samlefaktura-kladde oprettet i Dinero", color: "#8a6d3b" },
  Booked: { label: "Samlefaktura bogført i Dinero", color: "#2e7d32" },
  Sent: { label: "Samlefaktura sendt af Dinero", color: "#2e7d32" },
  Failed: { label: "Samlefakturering fejlede", color: "#C4183C" },
};

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = routeId(id);
  const o = await getOrderDetail(orderId);
  if (!o) notFound();
  const c = o.contact;
  // Erhvervs-samlefakturaens felter mappes ikke af getOrderDetail — hent dem
  // direkte, så status/fejl fra den månedlige batchkørsel (d. 20.) er synlige
  // her og ikke kun i cron-responsens JSON. Vises kun for erhvervskunder.
  const batch = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      businessBatchInvoiceStatus: true, businessBatchInvoiceNumber: true, businessBatchError: true,
      contact: { select: { isCompany: true } },
    },
  });
  const showBatch = !!batch?.contact.isCompany
    && !!(batch.businessBatchInvoiceStatus || batch.businessBatchInvoiceNumber || batch.businessBatchError);

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Rediger ordre #{o.id}</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>Ordredetaljer, opgaver og planlægning for den enkelte ordre.</p>
        </div>
        <Link href="/orders" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h4 className="section-title">Kunde</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>{c.name}</b>{"\n"}
              {c.street}, {c.city}{"\n"}
              {c.att && c.att !== "—" ? `Att: ${c.att}\n` : ""}
              {c.phone} · {c.email}{c.cvr ? `\nCVR: ${c.cvr}` : ""}
            </div>
            <div style={{ marginTop: 10 }}><MapLink address={`${c.street}, ${c.city}`} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4 className="section-title">Ordreinfo</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>Planlagt leveringstidspunkt</b>{"\n"}{o.plannedLabel}{"\n\n"}
              <b>Ordrestatus</b>{"\n"}<span> </span>
            </div>
            <div style={{ margin: "2px 0 10px" }}><StatusPill status={o.status} /></div>
            <div className="form-static">
              <b>Kilde</b>{"\n"}{o.source}{"\n\n"}
              <b>Medarbejder</b>{"\n"}{o.employee}
              {o.comment ? `\n\nOrdrekommentar\n${o.comment}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Opgaver på ordren</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Opgavebeskrivelse</th><th>Pris (inkl. moms)</th><th>Varighed (min.)</th></tr></thead>
              <tbody>
                {o.tasks.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <CatChip category={t.category} letter={t.letter} /> {t.description}
                      {t.fromSubscription ? <div className="muted" style={{ fontSize: 12 }}>Dette er en opgave fra abonnementet</div> : null}
                    </td>
                    <td className="num">{money(t.price)}</td>
                    <td className="num">{t.durationMin}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>Sum</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(o.sumPrice)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{o.sumDuration}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Planlægning i kalender</h4></div>
        <div className="card-body tight">
          <div className="form-static">
            Fastlåst: {o.lockedFully ? "Ja, helt fastlåst" : "Nej"}{"\n"}
            Leveringsadresse: {o.deliveryAddress}
          </div>
        </div>
      </div>

      {o.addressNote ? (
        <div className="card">
          <div className="card-header"><h4 className="section-title">Adressebemærkning</h4></div>
          <div className="card-body tight"><div className="form-static">{o.addressNote}</div></div>
        </div>
      ) : null}

      {o.invoiceDecision || o.dineroInvoiceStatus ? (
        <div className="card">
          <div className="card-header"><h4 className="section-title">Fakturering</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>Valg</b>{"\n"}{o.invoiceDecision || "—"}{"\n\n"}
              <b>Status</b>{"\n"}
              <span style={{ color: INVOICE_STATUS[o.dineroInvoiceStatus]?.color ?? "#6b7280" }}>
                {INVOICE_STATUS[o.dineroInvoiceStatus]?.label ?? (o.dineroInvoiceStatus || "Afventer")}
              </span>
              {o.dineroInvoiceNumber ? `\n\nFakturanr.\n${o.dineroInvoiceNumber}` : ""}
              {/* Afsendelse kan fejle EFTER en faktura er bogført. Status er da
                  stadig Booked (må ikke nedgraderes til Failed, da fakturaen er
                  juridisk bogført), men den præcise Dinero-fejl skal stadig være
                  synlig — ellers ligner det fejlagtigt en komplet succes. */}
              {o.dineroError ? `\n\nSeneste Dinero-fejl\n${o.dineroError}` : ""}
            </div>
            {o.invoiceDecision === "Registrer på et senere tidspunkt" ? (
              // "Registrer senere" has no concrete action to resume — send the user to
              // the complete flow to pick a real invoicing choice.
              <div style={{ marginTop: 12 }}>
                <Link href={`/orders/${o.id}/complete?back=${encodeURIComponent(`/orders/${o.id}`)}`} className="btn btn-outline-primary">Vælg fakturering</Link>
              </div>
            ) : o.dineroInvoiceStatus === "Failed" ||
              // Afsendelse kan fejle EFTER bogføring: status forbliver Booked/Sent
              // (nedgraderes aldrig, jf. lib/dinero.ts), men dineroError er sat —
              // retryInvoice er idempotent og genoptager fra det nåede trin, så
              // knappen skal vises i ALLE fejlscenarier.
              !!o.dineroError ||
              (o.invoiceDecision && o.invoiceDecision !== "Send ikke faktura fra Karltoffel" && !o.dineroInvoiceStatus) ? (
              <form action={retryInvoice.bind(null, o.id)} style={{ marginTop: 12 }}>
                <button type="submit" className="btn btn-outline-primary">Fakturér igen</button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {showBatch && batch ? (
        <div className="card">
          <div className="card-header"><h4 className="section-title">Månedlig samlefakturering (erhverv)</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              {/* Ærlig status fra den automatiske batchkørsel d. 20. (lib/
                  business-invoicing.ts) — især "Failed" + fejlen skal være
                  synlig her, ellers står erhvervsordren ufaktureret for evigt
                  uden noget signal i UI'et. */}
              <b>Status</b>{"\n"}
              <span style={{ color: BATCH_STATUS[batch.businessBatchInvoiceStatus ?? ""]?.color ?? "#6b7280" }}>
                {BATCH_STATUS[batch.businessBatchInvoiceStatus ?? ""]?.label ?? (batch.businessBatchInvoiceStatus || "Afventer næste kørsel (d. 20.)")}
              </span>
              {batch.businessBatchInvoiceNumber ? `\n\nFakturanr.\n${batch.businessBatchInvoiceNumber}` : ""}
              {batch.businessBatchError ? `\n\nSeneste fejl\n${batch.businessBatchError}` : ""}
            </div>
          </div>
        </div>
      ) : null}

      <div className="savebar">
        <Link href="/orders" className="btn btn-light">Luk</Link>
        <ConfirmButton
          action={deleteOrder.bind(null, o.id)}
          label="Slet ordre" title="Bekræftelse"
          body="Er du sikker på, at du vil slette ordren?" confirmLabel="Slet ordre"
        />
        <Link href={`/orders/${o.id}/send-tilbud`} className="btn btn-outline-primary">Send tilbud</Link>
        <Link href={`/orders/${o.id}/complete?back=${encodeURIComponent(`/orders/${o.id}`)}`} className="btn btn-primary">Afslut ordre</Link>
      </div>
    </div>
  );
}
