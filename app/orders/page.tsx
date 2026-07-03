import Link from "next/link";
import { getOrders, getContacts } from "@/lib/queries";
import { CatChip, CustomerCell, RowCaret, MapLink, StatusPill, money } from "@/components/ui";

export const metadata = { title: "Ordrer · Karltoffel" };

export default async function OrdersPage() {
  const [orders, contacts] = await Promise.all([getOrders(), getContacts()]);
  const contactById = (id: number) => contacts.find((c) => c.id === id);
  return (
    <div className="container-1140">
      <h1 className="page-title">Oversigt over ordrer</h1>
      <p className="page-desc">Oversigten viser alle ordrer i kalenderen både i fortiden og fremtiden.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            <div className="searchbar">
              <input className="form-control" placeholder="Ordrenr, dato, kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr, opgave" />
              <button className="btn btn-light">Søg</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }} /><th>Ordre nr.</th><th>Kunde</th><th>Leveringsadresse</th>
                  <th>Leverings-dato</th><th>Opgaver</th><th>Pris</th><th>Medarbejder</th><th>Ordrestatus</th><th>Kilde</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const c = contactById(o.contactId);
                  return (
                    <tr key={o.id}>
                      <td><RowCaret actions={["Vis ordre i kalender", "Rediger ordre", "Afslut ordre…", "Slet ordre…", "Opret ny ordre", "Rediger abonnement"]} /></td>
                      <td className="num"><Link href={`/orders/${o.id}`}>{o.id}</Link></td>
                      <td>{c ? <CustomerCell contact={c} withMap={false} /> : null}</td>
                      <td>{o.deliveryAddress}<div><MapLink address={o.deliveryAddress} /></div></td>
                      <td className="num" title={o.overdue ? "Ordren er ikke afsluttet" : "Ordren ligger i fremtiden"}>
                        {o.overdue ? <span className="badge badge-soft-warning">{o.deliveryDate}</span> : o.deliveryDate}
                      </td>
                      <td>{o.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                      <td className="num">{money(o.tasks.reduce((a, t) => a + t.price, 0))}</td>
                      <td>{o.employee}</td>
                      <td><StatusPill status="Afventer levering" /></td>
                      <td>{o.source}</td>
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
