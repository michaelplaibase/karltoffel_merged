import Link from "next/link";
import { kr } from "@/lib/data";
import { getContacts } from "@/lib/queries";
import { deleteContact } from "@/app/actions/contacts";
import { CustomerCell } from "@/components/ui";
import RowMenu from "@/components/RowMenu";
import { SearchBar, Pagination, paginate } from "@/components/ListControls";

export const metadata = { title: "Kunder · Karltoffel" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const all = await getContacts(q);
  const { slice, page, totalPages } = paginate(all, Number(sp.page) || 1);

  return (
    <div className="container-1140">
      <h1 className="page-title">Oversigt over kunder</h1>
      <p className="page-desc">Oversigten viser alle kunder, dvs. kontakter med én eller flere ordrer eller abonnementer.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            <Link href="/customers/new" className="btn btn-outline-primary">Opret ny kontakt</Link>
            <SearchBar placeholder="Kundenr, navn, email, tlf, vejnavn, husnr., postnr." q={q} />
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
                {slice.length === 0 ? (
                  <tr><td colSpan={6}><div className="table-empty">Ingen kunder fundet</div></td></tr>
                ) : slice.map((c) => (
                  <tr key={c.id}>
                    <td><RowMenu items={[
                      { label: "Se kundedetaljer", href: `/customers/${c.id}` },
                      { label: "Slet kunde…", danger: true, action: deleteContact.bind(null, c.id),
                        confirm: { title: "Slet kunde", body: `Er du sikker på, at du vil slette ${c.name}? Alle kundens abonnementer, fastprisaftaler og ordrer slettes også.`, confirmLabel: "Slet kunde", note: "Denne handling kan ikke fortrydes." } },
                    ]} /></td>
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

          <Pagination path="/customers" page={page} totalPages={totalPages} q={q} />
        </div>
      </div>
    </div>
  );
}
