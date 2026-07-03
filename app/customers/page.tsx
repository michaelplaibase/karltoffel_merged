import Link from "next/link";
import { kr } from "@/lib/data";
import { getContacts } from "@/lib/queries";
import { CustomerCell, RowCaret } from "@/components/ui";

export const metadata = { title: "Kunder · Karltoffel" };

export default async function CustomersPage() {
  const contacts = await getContacts();
  return (
    <div className="container-1140">
      <h1 className="page-title">Oversigt over kunder</h1>
      <p className="page-desc">Oversigten viser alle kunder, dvs. kontakter med én eller flere ordrer eller abonnementer.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            <Link href="/customers/new" className="btn btn-outline-primary">Opret ny kontakt</Link>
            <div className="searchbar">
              <input className="form-control" placeholder="Kundenr, navn, email, tlf, vejnavn, husnr., postnr." />
              <button className="btn btn-light">Søg</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }} />
                  <th>Kundenr.</th>
                  <th>Kunde</th>
                  <th>Omsætning ÅTD</th>
                  <th>Gns. oms/år fra abo.</th>
                  <th>Antal abo.</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><RowCaret actions={["Se kundedetaljer", "Slet kunde…"]} /></td>
                    <td className="num">
                      <Link href={`/customers/${c.id}`}>{c.id}</Link>
                    </td>
                    <td><CustomerCell contact={c} /></td>
                    <td className="num">{kr(c.revenueYtd)}</td>
                    <td className="num">{kr(c.avgYearlyFromSubs)}</td>
                    <td className="num">{c.subscriptionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-actions" style={{ justifyContent: "flex-end", marginTop: 14 }}>
            <span className="btn btn-sm btn-light">forrige</span>
            <span className="btn btn-sm btn-primary">1</span>
            <span className="btn btn-sm btn-light">næste</span>
          </div>
        </div>
      </div>
    </div>
  );
}
