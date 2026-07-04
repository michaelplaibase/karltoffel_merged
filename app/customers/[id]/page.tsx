import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactById, getSubscriptionsForContact, getFixedPricesForContact, getOrdersForContact } from "@/lib/queries";
import { CatChip, MapLink, StatusPill, money } from "@/components/ui";
import RowMenu, { type RowMenuItem } from "@/components/RowMenu";
import { stopSubscription } from "@/app/actions/subscriptions";
import { deleteFixedPrice } from "@/app/actions/fixed-prices";
import { deleteOrder } from "@/app/actions/orders";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getContactById(Number(id));
  if (!c) notFound();
  const [subs, fixedPrices, orders] = await Promise.all([
    getSubscriptionsForContact(c.id),
    getFixedPricesForContact(c.id),
    getOrdersForContact(c.id),
  ]);

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Kundedetaljer</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            Denne side viser informationer om en specifik kunde, bl.a. kundens abonnementer, fastprisaftaler og ordrer.
          </p>
        </div>
        <Link href="/customers" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h4 className="section-title">Kundens kontaktinfo</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>{c.name}</b>{"\n"}
              {c.street}, {c.city}{"\n"}
              {c.phone} · {c.email}{c.cvr ? `\nCVR: ${c.cvr}` : ""}
            </div>
            <div style={{ marginTop: 10 }}><MapLink address={`${c.street}, ${c.city}`} /></div>
            <div className="row-actions" style={{ marginTop: 16 }}>
              <Link href={`/customers/${c.id}/edit`} className="btn btn-outline-primary btn-sm">Rediger kontaktinfo</Link>
              <Link href="/customers/new" className="btn btn-light btn-sm">Opret ny kontakt</Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4 className="section-title">Kundens indstillinger</h4></div>
          <div className="card-body tight">
            <p className="muted" style={{ margin: "4px 0 14px" }}>Klik for at redigere kundens indstillinger (fakturalinje-visning + forudindstilling for betaling/fakturering).</p>
            <Link href={`/customers/${c.id}/settings`} className="btn btn-outline-primary btn-sm">Rediger indstillinger</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 className="section-title">Kundens abonnementer</h4>
          <Link href={`/subscriptions/new?for_contact=${c.id}`} className="btn btn-primary btn-sm">Opret nyt abonnement på kunden</Link>
        </div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th style={{ width: 34 }} /><th>Abo. nr.</th><th>Leveringsadresse</th><th>Opgaver</th><th>Interval</th><th>Pris</th><th>Fast medarb.</th><th>Fremtidige ordrer</th></tr></thead>
              <tbody>
                {subs.length === 0 ? (
                  <tr><td colSpan={8}><div className="table-empty">Ingen abonnementer</div></td></tr>
                ) : subs.map((s) => (
                  <tr key={s.id}>
                    <td><RowMenu items={[
                      { label: "Rediger abonnement", href: `/subscriptions/${s.id}` },
                      { label: "Stop abonnement…", danger: true, action: stopSubscription.bind(null, s.pk),
                        confirm: { title: "Stop abonnement", body: `Vil du stoppe abonnement #${s.id}? Der oprettes ikke flere ordrer på abonnementet.`, confirmLabel: "Stop abonnement", note: "Denne handling kan ikke fortrydes." } },
                    ]} /></td>
                    <td className="num"><Link href={`/subscriptions/${s.id}`}>{s.id}</Link></td>
                    <td>{s.deliveryAddress}</td>
                    <td>{s.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                    <td>{s.tasks.map((t, i) => <div key={i}>{t.interval}</div>)}</td>
                    <td className="num">{s.tasks.map((t, i) => <div key={i}>{money(t.price)}</div>)}</td>
                    <td>{s.fixedEmployee}</td>
                    <td>{s.nextWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 className="section-title">Kundens fastprisaftaler</h4>
          <Link href={`/fixed-prices/new?for_contact=${c.id}`} className="btn btn-primary btn-sm">Opret ny fastprisaftale på kunden</Link>
        </div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th style={{ width: 34 }} /><th>Aftale nr.</th><th>Leveringsadresse</th><th>Opgaver</th><th>Pris</th></tr></thead>
              <tbody>
                {fixedPrices.length === 0 ? (
                  <tr><td colSpan={5}><div className="table-empty">Ingen fastprisaftaler fundet for kunden</div></td></tr>
                ) : fixedPrices.map((f) => (
                  <tr key={f.id}>
                    <td><RowMenu items={[
                      { label: "Rediger fastprisaftale", href: `/fixed-prices/${f.id}` },
                      { label: "Slet fastprisaftale…", danger: true, action: deleteFixedPrice.bind(null, f.pk),
                        confirm: { title: "Slet fastprisaftale", body: `Er du sikker på, at du vil slette fastprisaftale #${f.id}?`, confirmLabel: "Slet fastprisaftale", note: "Denne handling kan ikke fortrydes." } },
                    ]} /></td>
                    <td className="num"><Link href={`/fixed-prices/${f.id}`}>{f.id}</Link></td>
                    <td>{f.deliveryAddress}</td>
                    <td>{f.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                    <td className="num">{f.tasks.map((t, i) => <div key={i}>{money(t.price)}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 className="section-title">Kundens ordrer</h4>
          <Link href={`/orders/new?for_contact=${c.id}`} className="btn btn-primary btn-sm">Opret ny ordre på kunden</Link>
        </div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th style={{ width: 34 }} /><th>Ordre nr.</th><th>Leverings-dato</th><th>Opgaver</th><th>Pris</th><th>Medarbejder</th><th>Ordrestatus</th><th>Kilde</th></tr></thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8}><div className="table-empty">Ingen ordrer</div></td></tr>
                ) : orders.map((o) => {
                  const items: RowMenuItem[] = [
                    { label: "Vis ordre i kalender", href: `/calendar?week=${o.weekMonday}` },
                    { label: "Rediger ordre", href: `/orders/${o.id}` },
                    { label: "Afslut ordre…", href: `/orders/${o.id}/complete` },
                    { label: "Opret ny ordre", href: `/orders/new?for_contact=${o.contactId}` },
                    ...(o.subscriptionNo ? [{ label: "Rediger abonnement", href: `/subscriptions/${o.subscriptionNo}` }] : []),
                    { label: "Slet ordre…", danger: true, action: deleteOrder.bind(null, o.id),
                      confirm: { title: "Slet ordre", body: `Er du sikker på, at du vil slette ordre #${o.id}?`, confirmLabel: "Slet ordre", note: "Denne handling kan ikke fortrydes." } },
                  ];
                  return (
                  <tr key={o.id}>
                    <td><RowMenu items={items} /></td>
                    <td className="num"><Link href={`/orders/${o.id}`}>{o.id}</Link></td>
                    <td className="num">{o.overdue ? <span className="badge badge-soft-warning">{o.deliveryDate}</span> : o.deliveryDate}</td>
                    <td>{o.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                    <td className="num">{money(o.tasks.reduce((a, t) => a + t.price, 0))}</td>
                    <td>{o.employee}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td>{o.subscriptionNo ? <Link href={`/subscriptions/${o.subscriptionNo}`}>{o.source}</Link> : o.source}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
