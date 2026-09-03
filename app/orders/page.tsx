import Link from "next/link";
import { getOrdersPage } from "@/lib/queries";
import { deleteOrder } from "@/app/actions/orders";
import { todayCphISO } from "@/lib/calendar";
import { CatChip, CustomerCell, MapLink, StatusPill, money } from "@/components/ui";
import RowMenu, { type RowMenuItem } from "@/components/RowMenu";
import { SearchBar, Pagination } from "@/components/ListControls";

export const metadata = { title: "Ordrer · Karltoffel Business Manager" };

/** Spejler CLOSED_STATUSES i lib/queries.ts — lukkede ordrer er aldrig "forfaldne". */
const CLOSED_STATUSES = new Set(["Afsluttet", "Udført", "Sprunget over"]);

/** Tooltip på leveringsdatoen. !overdue dækker TRE tilfælde (jf. isOverdue i
 *  lib/queries.ts): lukket status, leveres i dag og fremtidige ordrer — en
 *  udført fortidsordre må ikke påstås at "ligge i fremtiden". */
function deliveryTitle(o: { overdue: boolean; status: string; deliveryDate: string }, todayISO: string): string {
  if (o.overdue) return "Ordren er ikke afsluttet";
  if (CLOSED_STATUSES.has(o.status)) return "Ordren er afsluttet";
  if (o.deliveryDate === todayISO) return "Ordren leveres i dag";
  return "Ordren ligger i fremtiden";
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  // Server-side paginering: kun sidens ordrer (og netop deres kontakter) hentes.
  const { orders, contacts, page, totalPages } = await getOrdersPage(q, Number(sp.page) || 1);
  const contactById = (id: number) => contacts.find((c) => c.id === id);
  const todayISO = todayCphISO();
  // Nuvarende liste-URL (inkl. søgning + side) — så "Slet ordre" bliver stående
  // på samme filtrerede side i stedet for at smide brugeren til /orders side 1.
  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (page > 1) listParams.set("page", String(page));
  const listQs = listParams.toString();
  const listUrl = listQs ? `/orders?${listQs}` : "/orders";
  return (
    <div className="container-1140">
      <h1 className="page-title">Oversigt over ordrer</h1>
      <p className="page-desc">Oversigten viser alle ordrer i kalenderen både i fortiden og fremtiden.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            <SearchBar placeholder="Ordrenr, dato (fx 13/7-2026), kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr, opgave" q={q} />
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
                {orders.length === 0 ? (
                  <tr><td colSpan={10}><div className="table-empty">Ingen ordrer fundet</div></td></tr>
                ) : orders.map((o) => {
                  const c = contactById(o.contactId);
                  const items: RowMenuItem[] = [
                    { label: "Vis ordre i kalender", href: `/calendar?week=${o.weekMonday}` },
                    { label: "Rediger ordre", href: `/orders/${o.id}` },
                    { label: "Afslut ordre…", href: `/orders/${o.id}/complete?back=${encodeURIComponent(listUrl)}` },
                    { label: "Opret ny ordre", href: `/orders/new?for_contact=${o.contactId}` },
                    ...(o.subscriptionNo ? [{ label: "Rediger abonnement", href: `/subscriptions/${o.subscriptionNo}` }] : []),
                    { label: "Slet ordre…", danger: true, action: deleteOrder.bind(null, o.id, listUrl),
                      confirm: { title: "Slet ordre", body: `Er du sikker på, at du vil slette ordre #${o.id}?`, confirmLabel: "Slet ordre", note: "Denne handling kan ikke fortrydes." } },
                  ];
                  return (
                    <tr key={o.id}>
                      <td><RowMenu items={items} /></td>
                      <td className="num"><Link href={`/orders/${o.id}`}>{o.id}</Link></td>
                      <td>{c ? <CustomerCell contact={c} withMap={false} /> : null}</td>
                      <td>{o.deliveryAddress}<div><MapLink address={o.deliveryAddress} /></div></td>
                      <td className="num" title={deliveryTitle(o, todayISO)}>
                        {o.overdue ? <span className="badge badge-soft-warning">{o.deliveryDate}</span> : o.deliveryDate}
                      </td>
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

          <Pagination path="/orders" page={page} totalPages={totalPages} q={q} />
        </div>
      </div>
    </div>
  );
}
