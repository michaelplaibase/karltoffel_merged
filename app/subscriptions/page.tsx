import Link from "next/link";
import { prisma } from "@/lib/db";
import { mondayOf, weekLabel } from "@/lib/weeks";
import { getSubscriptions, getContacts } from "@/lib/queries";
import { stopSubscription, approveSubscription } from "@/app/actions/subscriptions";
import GenerateOrdersButton from "@/components/GenerateOrdersButton";
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

  // "Fremtidige ordrer": den FAKTISKE næste ikke-afsluttede ordres uge — ikke
  // den statiske nextWeek-etiket fra oprettelsen, som aldrig opdateres af
  // genereringen og derfor fejlinformerer om, hvornår næste besøg er.
  const nextRows = await prisma.order.groupBy({
    by: ["subscriptionId"],
    where: {
      subscriptionId: { in: subscriptions.map((s) => s.pk) },
      status: "Afventer levering",
      plannedAt: { gte: mondayOf(new Date()) },
    },
    _min: { plannedAt: true },
  });
  const nextBySub = new Map(nextRows.map((r) => [r.subscriptionId, r._min.plannedAt]));
  const nextOrderLabel = (pk: number) => {
    const at = nextBySub.get(pk);
    return at ? weekLabel(mondayOf(at).toISOString().slice(0, 10)) : "Ingen planlagte";
  };

  return (
    <div className="container-1140">
      <h1 className="page-title">Oversigt over abonnementer</h1>
      <p className="page-desc">Oversigten viser alle aktive abonnementer.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            <Link href="/subscriptions/new" className="btn btn-outline-primary">Opret nyt abonnement</Link>
            <GenerateOrdersButton />
            <SearchBar placeholder="Abo. nr, dato, kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr, opgave" q={q} />
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
                {subscriptions.length === 0 ? (
                  <tr><td colSpan={9}><div className="table-empty">Ingen abonnementer fundet</div></td></tr>
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
                      <td className="num">
                        <Link href={`/subscriptions/${s.id}`}>{s.id}</Link>
                        {s.pending ? <span className="badge badge-soft-warning" style={{ marginLeft: 6 }}>Afventende</span> : null}
                      </td>
                      <td>{c ? <CustomerCell contact={c} withMap={false} /> : null}</td>
                      <td>{s.deliveryAddress}<div><MapLink address={s.deliveryAddress} /></div></td>
                      <td>{s.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
                      <td>{s.tasks.map((t, i) => <div key={i}>{t.interval}</div>)}</td>
                      <td className="num">{s.tasks.map((t, i) => <div key={i}>{money(t.price)}</div>)}</td>
                      <td>{s.fixedEmployee}</td>
                      <td>{nextOrderLabel(s.pk)}</td>
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
