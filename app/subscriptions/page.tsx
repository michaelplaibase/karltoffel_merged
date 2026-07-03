import Link from "next/link";
import { getSubscriptions, getContacts } from "@/lib/queries";
import { CatChip, CustomerCell, RowCaret, MapLink, money } from "@/components/ui";

export const metadata = { title: "Abonnementer · Karltoffel" };

export default async function SubscriptionsPage() {
  const [subscriptions, contacts] = await Promise.all([getSubscriptions(), getContacts()]);
  const contactById = (id: number) => contacts.find((c) => c.id === id);
  return (
    <div className="container-1140">
      <h1 className="page-title">Oversigt over abonnementer</h1>
      <p className="page-desc">Oversigten viser alle aktive abonnementer.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            <span className="btn btn-outline-primary">Opret nyt abonnement</span>
            <div className="searchbar">
              <input className="form-control" placeholder="Abo. nr, dato, kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr, opgave" />
              <button className="btn btn-light">Søg</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }} /><th>Abo. nr.</th><th>Kunde</th><th>Leveringsadresse</th>
                  <th>Opgaver</th><th>Interval</th><th>Pris</th><th>Fast medarb.</th><th>Fremtidige ordrer</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => {
                  const c = contactById(s.contactId);
                  return (
                    <tr key={s.id}>
                      <td><RowCaret actions={["Rediger abonnement", "Stop abonnement…"]} /></td>
                      <td className="num"><Link href={`/subscriptions/${s.id}`}>{s.id}</Link></td>
                      <td>{c ? <CustomerCell contact={c} withMap={false} /> : null}</td>
                      <td>{s.deliveryAddress}<div><MapLink address={s.deliveryAddress} /></div></td>
                      <td>{s.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                      <td>{s.tasks.map((t, i) => <div key={i}>{t.interval}</div>)}</td>
                      <td className="num">{s.tasks.map((t, i) => <div key={i}>{money(t.price)}</div>)}</td>
                      <td>{s.fixedEmployee}</td>
                      <td>{s.nextWeek}</td>
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
