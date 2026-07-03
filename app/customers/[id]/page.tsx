import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactById, getSubscriptionsForContact, getOrdersForContact } from "@/lib/queries";
import { CatChip, MapLink, RowCaret, StatusPill, money } from "@/components/ui";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getContactById(Number(id));
  if (!c) notFound();
  const [subs, orders] = await Promise.all([
    getSubscriptionsForContact(c.id),
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
                    <td><RowCaret actions={["Rediger abonnement", "Stop abonnement…"]} /></td>
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
        <div className="card-header"><h4 className="section-title">Kundens fastprisaftaler</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Aftale nr.</th><th>Leveringsadresse</th><th>Opgaver</th><th>Pris</th></tr></thead>
              <tbody><tr><td colSpan={4}><div className="table-empty">Ingen fastprisaftaler fundet for kunden</div></td></tr></tbody>
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
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><RowCaret actions={["Vis ordre i kalender", "Rediger ordre", "Afslut ordre…", "Slet ordre…", "Opret ny ordre", "Rediger abonnement"]} /></td>
                    <td className="num"><Link href={`/orders/${o.id}`}>{o.id}</Link></td>
                    <td className="num">{o.overdue ? <span className="badge badge-soft-warning">{o.deliveryDate}</span> : o.deliveryDate}</td>
                    <td>{o.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                    <td className="num">{money(o.tasks.reduce((a, t) => a + t.price, 0))}</td>
                    <td>{o.employee}</td>
                    <td><StatusPill status="Afventer levering" /></td>
                    <td>{o.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
