import Link from "next/link";
import { getSubscriptions, getContacts } from "@/lib/queries";
import { regenerateOrders, stopSubscription, approveSubscription } from "@/app/actions/subscriptions";
import { CatChip, CustomerCell, MapLink, money } from "@/components/ui";
import RowMenu from "@/components/RowMenu";
import { SearchBar, Pagination, paginate } from "@/components/ListControls";

export const metadata = { title: "Abonnementer · Karltoffel" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const [all, contacts] = await Promise.all([getSubscriptions(q), getContacts()]);
  const contactById = (id: number) => contacts.find((c) => c.id === id);
  const { slice: subscriptions, page, totalPages } = paginate(all, Number(sp.page) || 1);
  return (
    <div className="container-1140">
      <h1 className="page-title">Oversigt over abonnementer</h1>
      <p className="page-desc">Oversigten viser alle aktive abonnementer.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            <Link href="/subscriptions/new" className="btn btn-outline-primary">Opret nyt abonnement</Link>
            <form action={regenerateOrders} style={{ display: "inline" }}>
              <button type="submit" className="btn btn-light" title="Opret kommende ordrer for alle abonnementer">Generér kommende ordrer</button>
            </form>
            <SearchBar placeholder="Abo. nr, dato, kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr, opgave" q={q} />
          </div>

          <div className="table-wrap">
            <table className="data-table rowstack">
              <thead>
                <tr>
                  <th style={{ width: 34 }} /><th>Abo. nr.</th><th>Kunde</th><th>Leveringsadresse</th>
                  <th>Opgaver</th><th>Interval</th><th>Pris</th><th>Fast medarb.</th><th>Fremtidige ordrer</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr><td colSpan={9} data-fullspan><div className="table-empty">Ingen abonnementer fundet</div></td></tr>
                ) : subscriptions.map((s) => {
                  const c = contactById(s.contactId);
                  return (
                    <tr key={s.id}>
                      <td><RowMenu items={[
                        ...(s.pending
                          ? [{ label: "Godkend abonnement…", action: approveSubscription.bind(null, s.pk),
                              confirm: { title: "Godkend abonnement", body: `Godkend abonnement #${s.id}? Abonnementet aktiveres, og de kommende ordrer lægges i kalenderen.`, confirmLabel: "Godkend" } }]
                          : []),
                        { label: "Rediger abonnement", href: `/subscriptions/${s.id}` },
                        { label: "Stop abonnement…", danger: true, action: stopSubscription.bind(null, s.pk),
                          confirm: { title: "Stop abonnement", body: `Vil du stoppe abonnement #${s.id}? Der oprettes ikke flere ordrer, og kommende uleverede (ulåste) ordrer fjernes fra kalenderen.`, confirmLabel: "Stop abonnement", note: "Denne handling kan ikke fortrydes." } },
                      ]} /></td>
                      <td className="num" data-label="Abo. nr.">
                        <Link href={`/subscriptions/${s.id}`}>{s.id}</Link>
                        {s.pending ? <span className="badge badge-soft-warning" style={{ marginLeft: 6 }}>Afventende</span> : null}
                      </td>
                      <td data-label="Kunde">{c ? <CustomerCell contact={c} withMap={false} /> : null}</td>
                      <td data-label="Leveringsadresse">{s.deliveryAddress}<div><MapLink address={s.deliveryAddress} /></div></td>
                      <td data-label="Opgaver">{s.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                      <td data-label="Interval">{s.tasks.map((t, i) => <div key={i}>{t.interval}</div>)}</td>
                      <td className="num" data-label="Pris">{s.tasks.map((t, i) => <div key={i}>{money(t.price)}</div>)}</td>
                      <td data-label="Fast medarb.">{s.fixedEmployee}</td>
                      <td data-label="Fremtidige ordrer">{s.nextWeek}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination path="/subscriptions" page={page} totalPages={totalPages} q={q} />
        </div>
      </div>
    </div>
  );
}
