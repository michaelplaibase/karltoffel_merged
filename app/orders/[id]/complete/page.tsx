import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { routeId } from "@/lib/route-ids";
import { completeOrder } from "@/app/actions/orders";
import { isInvoiceDecision } from "@/lib/dinero";
import { getSettingsValues } from "@/lib/settings-store";
import { MapLink } from "@/components/ui";
import CompleteOrderForm from "@/components/CompleteOrderForm";

export const metadata = { title: "Afslut ordre · Karltoffel Business Manager" };

export default async function CompleteOrderPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const orderId = routeId(id);
  const o = await getOrderDetail(orderId);
  if (!o) notFound();
  const c = o.contact;

  // Returmål fra afsenderen (?back=...) — dagsprogrammet/kundesiden/ordrelisten
  // sender deres egen sti med, så medarbejderen lander tilbage hvor hun kom
  // fra. Accepter KUN interne, relative stier: "/" men aldrig "//host",
  // backslash eller kontroltegn/whitespace (browsere normaliserer "/\evil.com"
  // og striber tab/CR/LF, så begge dele ville ellers blive "//evil.com").
  const backUrl = sp.back && sp.back.startsWith("/") && !sp.back.startsWith("//") && !/[\x00-\x20\\]/.test(sp.back) ? sp.back : "/orders";

  // Kundens "Forudindstilling for Betaling og fakturering" (Contact.
  // invoiceChoicePreselect) — bruges kun når ordren endnu ingen gemt
  // beslutning har. "Anvend standardindstilling"/"default" falder tilbage til
  // den GLOBALE forudindstilling fra Indstillinger → Afslut ordre
  // (/settings, felt s4f2) — Thomas/Michael 2026-09-02: "Alle kunder skal
  // være default på Send faktura - ubetalt", så global standard + kontakt-
  // override skal begge gælde her, ikke kun kontakt-overriden.
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    select: { contact: { select: { invoiceChoicePreselect: true } } },
  });
  const contactPreselect = row?.contact.invoiceChoicePreselect ?? "";
  let preselect = contactPreselect;
  if (!isInvoiceDecision(preselect) && contactPreselect !== "Blank (ingen forudindstilling)") {
    // Kontakt har ingen egen override (standardindstilling/default) → brug
    // virksomhedens globale forudindstilling, hvis der er valgt en.
    const globalValues = await getSettingsValues("/settings");
    const globalPreselect = globalValues.s4f2?.[0] ?? "";
    if (isInvoiceDecision(globalPreselect)) preselect = globalPreselect;
  }
  if (!isInvoiceDecision(preselect) && contactPreselect !== "Blank (ingen forudindstilling)") {
    // Michael 2026-09-02: "Default på alle privatkunder = send faktura, så
    // snart opgaven er udført." Hverken kontakt-override eller global
    // indstilling siger noget andet → forudvælg faktura pr. gang. Erhvervs-
    // kontakter rammes ikke reelt: pr.-ordre-flowet viderestiller dem til
    // samlefaktura-sporet (værnet i lib/dinero.ts issueInvoiceForOrder).
    preselect = "Send faktura - ubetalt";
  }
  const paymentPreselect = !o.invoiceDecision && isInvoiceDecision(preselect) ? preselect : undefined;

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title">Afslut ordre</h1>
        <Link href={backUrl} className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h4 className="section-title">Kundeinfo</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>{c.name}</b>{"\n"}
              {c.street}, {c.city}{"\n"}
              {c.att && c.att !== "—" ? `Att: ${c.att}\n` : ""}
              {c.phone} · {c.email}
            </div>
            <div style={{ marginTop: 10 }}><MapLink address={`${c.street}, ${c.city}`} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4 className="section-title">Pris</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              Pris uden kørsel kr. {o.sumPrice.toLocaleString("da-DK")}{"\n"}
              Kørselsgebyr kr. 0{"\n"}
              <span className="muted">(Alle beløb er inkl. moms)</span>
            </div>
          </div>
        </div>
      </div>

      <CompleteOrderForm
        action={completeOrder.bind(null, orderId)}
        initialComment={o.comment}
        initialAddressNote={o.addressNote}
        backUrl={backUrl}
        paymentPreselect={paymentPreselect}
      />
    </div>
  );
}
