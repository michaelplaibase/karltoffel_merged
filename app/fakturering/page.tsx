// Faktureringsoverblik (Thomas, 2026-09-02 / 2026-09-17): ét samlet sted der
// viser, hvad der er meldt færdigt og venter på fakturering, hvad der allerede er
// faktureret, og hvad der IKKE er meldt færdigt endnu.
// Alle uafregnede opgaver på samme kunde samles automatisk på ÉN samlet faktura.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/api-auth";
import { invoiceLabel, invoiceTone, CLOSED_STATUSES as CLOSED } from "@/lib/invoice-status";
import { todayCphISO } from "@/lib/calendar";
import { CatChip, money } from "@/components/ui";
import VerifyInvoicingButton from "@/components/VerifyInvoicingButton";
import CleanupDescriptionsButton from "@/components/CleanupDescriptionsButton";
import InvoiceAllButton from "@/components/InvoiceAllButton";
import InvoiceNowButton from "@/components/InvoiceNowButton";
import NotDoneRowActions from "@/components/NotDoneRowActions";
import ManualInvoiceLineForm from "@/components/ManualInvoiceLineForm";

export const metadata = { title: "Faktureringsoverblik · Karltoffel Business Manager" };

/** UTC-dato som "YYYY-MM-DD" (samme konvention som lib/queries.ts ymd). */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Row = {
  id: number;
  contactId: number;
  customer: string;
  date: string;
  employee: string;
  price: number;
  status: string;
  weekMonday: string;
  invoice: string | null;
  invoiceTone: "red" | "yellow" | "green" | null;
  tasks: { category: string; letter: string; description: string }[];
};

type CustomerGroup = {
  contactId: number;
  customer: string;
  isCompany: boolean;
  invoiceFrequency: string | null;
  orders: Row[];
  ordersSum: number;
  manualLines: { id: number; description: string; quantity: number; priceInclVat: number; total: number }[];
  manualSum: number;
  totalSum: number;
  openInvoiceId?: number;
  dateSummary: string;
  sendRuleLabel: string;
};

async function loadRows(): Promise<Row[]> {
  const today = new Date(`${todayCphISO()}T00:00:00.000Z`);
  const rows = await prisma.order.findMany({
    where: { plannedAt: { lte: today } },
    include: { tasks: true, employee: true, contact: true },
    orderBy: { plannedAt: "desc" },
    take: 500,
  });
  return rows.map((o) => {
    const wd = (o.plannedAt.getUTCDay() + 6) % 7;
    const monday = new Date(o.plannedAt.getTime() - wd * 864e5);
    return {
      id: o.id,
      contactId: o.contactId,
      customer: o.contact.name,
      date: ymd(o.plannedAt),
      employee: o.employee ? `${o.employee.firstName} ${o.employee.lastName}` : "Ingen",
      price: o.tasks.reduce((a, t) => a + t.price, 0),
      status: o.status,
      weekMonday: ymd(monday),
      invoice: invoiceLabel(o),
      invoiceTone: invoiceTone(o),
      tasks: [...o.tasks]
        .sort((a, b) => a.sort - b.sort)
        .map((t) => ({ category: t.category, letter: t.letter, description: t.description })),
    };
  });
}

function Table({
  rows,
  empty,
  showInvoiceNow = false,
  showNotDoneActions = false,
}: {
  rows: Row[];
  empty: string;
  showInvoiceNow?: boolean;
  showNotDoneActions?: boolean;
}) {
  if (rows.length === 0) return <div className="table-empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ordre nr.</th>
            <th>Kunde</th>
            <th>Leverings-dato</th>
            <th>Opgaver</th>
            <th>Pris</th>
            <th>Medarbejder</th>
            <th>Status</th>
            <th>Faktura</th>
            {showInvoiceNow ? <th>Fakturer</th> : null}
            {showNotDoneActions ? <th>Ryd op</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="num">
                <Link href={`/orders/${o.id}`}>{o.id}</Link>
                {" · "}
                <Link href={`/calendar?week=${o.weekMonday}`}>kalender</Link>
              </td>
              <td>
                <Link href={`/customers/${o.contactId}`}>{o.customer}</Link>
              </td>
              <td className="num">{o.date}</td>
              <td>
                {o.tasks.map((t, i) => (
                  <div key={i}>
                    <CatChip category={t.category} letter={t.letter} /> {t.description}
                  </div>
                ))}
              </td>
              <td className="num">{money(o.price)}</td>
              <td>{o.employee}</td>
              <td>{o.status}</td>
              <td>
                {o.invoiceTone === "green" ? (
                  <span className="badge badge-soft-success">{o.invoice}</span>
                ) : o.invoiceTone === "yellow" ? (
                  <span className="badge badge-soft-warning">{o.invoice}</span>
                ) : o.invoiceTone === "red" ? (
                  <span className="badge badge-soft-danger">{o.invoice}</span>
                ) : (
                  <span className="badge badge-soft-danger">Faktura ikke afsendt</span>
                )}
              </td>
              {showInvoiceNow ? (
                <td>
                  <InvoiceNowButton orderId={o.id} contactId={o.contactId} />
                </td>
              ) : null}
              {showNotDoneActions ? (
                <td>
                  <NotDoneRowActions orderId={o.id} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function InvoicingOverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const rows = await loadRows();

  // 1) Færdigmeldt (Udført) og stadig uden faktura → klar til at blive faktureret.
  const ready = rows.filter((o) => o.status === "Udført" && !o.invoice);
  // 2) Faktureret / afsluttet uden faktura-behov — alt med en faktura-status
  const done = rows.filter((o) => o.invoice !== null);
  // 3) IKKE meldt færdigt: fortidsordre der hverken er Udført, Afsluttet eller Sprunget over
  const notDone = rows.filter((o) => !CLOSED.has(o.status));
  const sum = (rs: Row[]) => rs.reduce((a, o) => a + o.price, 0);

  // Åbne fakturaer (2026-09-15): u-bogførte Dinero-kladder
  const openInvoices = await prisma.openInvoice.findMany({
    where: { status: "Draft" },
    include: {
      contact: { select: { id: true, name: true, invoiceFrequency: true, isCompany: true } },
      manualLines: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const openInvoiceMap = new Map(openInvoices.map((inv) => [inv.contactId, inv]));

  // Gruppér uafregnede udførte ordrer pr. kunde (Thomas, 2026-09-17)
  const readyContactIds = [...new Set(ready.map((o) => o.contactId))];
  const contacts = await prisma.contact.findMany({
    where: { id: { in: readyContactIds } },
    select: { id: true, name: true, isCompany: true, invoiceFrequency: true },
  });
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const readyByContact = new Map<number, Row[]>();
  for (const o of ready) {
    const list = readyByContact.get(o.contactId) ?? [];
    list.push(o);
    readyByContact.set(o.contactId, list);
  }

  const customerGroups: CustomerGroup[] = [];
  for (const [contactId, contactOrders] of readyByContact) {
    const contact = contactMap.get(contactId);
    const openInv = openInvoiceMap.get(contactId);
    const manualLines = (openInv?.manualLines ?? []).map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity),
      priceInclVat: l.priceInclVat,
      total: Number(l.quantity) * l.priceInclVat,
    }));

    const ordersSum = contactOrders.reduce((a, o) => a + o.price, 0);
    const manualSum = manualLines.reduce((a, l) => a + l.total, 0);
    const totalSum = ordersSum + manualSum;

    // Sorter ordrer efter dato faldende
    contactOrders.sort((a, b) => b.date.localeCompare(a.date));

    // Dato-interval
    const dates = contactOrders.map((o) => o.date).sort();
    const dateSummary =
      dates.length === 1 || dates[0] === dates[dates.length - 1]
        ? dates[0]
        : `${dates[0]} – ${dates[dates.length - 1]}`;

    const isCompany = contact?.isCompany ?? false;
    const freq =
      contact?.invoiceFrequency === "maaned" || contact?.invoiceFrequency === "kvartal"
        ? contact.invoiceFrequency
        : contact?.invoiceFrequency === "pr_gang"
        ? "pr_gang"
        : isCompany
        ? "maaned"
        : "pr_gang";

    const sendRuleLabel =
      freq === "pr_gang"
        ? "Privat · Faktura straks"
        : `Erhverv · Samles normalt d. 20. (${freq === "kvartal" ? "kvartal" : "måned"})`;

    customerGroups.push({
      contactId,
      customer: contact?.name ?? contactOrders[0]?.customer ?? "Ukendt kunde",
      isCompany,
      invoiceFrequency: contact?.invoiceFrequency ?? null,
      orders: contactOrders,
      ordersSum,
      manualLines,
      manualSum,
      totalSum,
      openInvoiceId: openInv?.id,
      dateSummary,
      sendRuleLabel,
    });
  }

  // Kunder med flere opgaver vises øverst, så Thomas direkte ser at de samles
  customerGroups.sort((a, b) => {
    if (b.orders.length !== a.orders.length) {
      return b.orders.length - a.orders.length;
    }
    return b.totalSum - a.totalSum;
  });

  const totalReadySum = customerGroups.reduce((a, c) => a + c.totalSum, 0);

  const openRows = await Promise.all(
    openInvoices.map(async (inv) => {
      const orders = await prisma.order.findMany({
        where: { businessBatchInvoiceGuid: inv.guid },
        include: { tasks: true },
        orderBy: { plannedAt: "desc" },
      });
      const manualSum = inv.manualLines.reduce((a, l) => a + Number(l.quantity) * l.priceInclVat, 0);
      const ordersSum = orders.reduce((a, o) => a + o.tasks.reduce((b, t) => b + t.price, 0), 0);
      const freq =
        inv.contact.invoiceFrequency === "maaned" || inv.contact.invoiceFrequency === "kvartal"
          ? inv.contact.invoiceFrequency
          : inv.contact.invoiceFrequency === "pr_gang"
          ? "pr_gang"
          : inv.contact.isCompany
          ? "maaned"
          : "pr_gang";
      const sendDay =
        freq === "pr_gang"
          ? "sendes straks ved næste afslutning"
          : `sendes d. 20. (${freq === "kvartal" ? "kvartal" : "måned"})`;
      return {
        id: inv.id,
        contactId: inv.contact.id,
        customer: inv.contact.name,
        orders: orders.map((o) => ({ id: o.id, price: o.tasks.reduce((a, t) => a + t.price, 0) })),
        manual: inv.manualLines.map((l) => ({
          id: l.id,
          description: l.description,
          total: Number(l.quantity) * l.priceInclVat,
        })),
        sum: ordersSum + manualSum,
        sendDay,
      };
    }),
  );

  return (
    <div className="container-1140 container-wide">
      <h1 className="page-title">Faktureringsoverblik</h1>
      <p className="page-desc">
        Alt der er meldt færdigt og venter på faktura, alt der allerede er faktureret,
        og alt der endnu ikke er meldt færdigt. Ordrer til samme kunde samles automatisk på én faktura.
      </p>

      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <VerifyInvoicingButton />
          <CleanupDescriptionsButton />
          {/* "Fakturér alle": sender alle klar-til-faktura ordrer med det samme */}
          <InvoiceAllButton />
        </div>

        {/* ÅBNE FAKTURAER (kladdeposter i Dinero) */}
        {openRows.length > 0 ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h4 className="section-title">Åbne fakturakladder ({openRows.length})</h4>
            </div>
            <div className="card-body tight">
              {openRows.map((inv) => (
                <div key={inv.id} className="card" style={{ marginBottom: 12 }}>
                  <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <h5 className="section-title" style={{ margin: 0 }}>
                      <Link href={`/customers/${inv.contactId}`}>{inv.customer}</Link> — {money(inv.sum)} · {inv.sendDay}
                    </h5>
                    {user.isAdmin ? (
                      <InvoiceNowButton contactId={inv.contactId} label={`Afsend faktura nu (${money(inv.sum)})`} />
                    ) : null}
                  </div>
                  <div className="card-body tight">
                    {inv.orders.length === 0 && inv.manual.length === 0 ? (
                      <div className="help-note">Ingen linjer registreret i CRM endnu.</div>
                    ) : (
                      <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                        {inv.orders.map((o) => (
                          <li key={`o${o.id}`}>
                            <Link href={`/orders/${o.id}`}>Ordre #{o.id}</Link> — {money(o.price)}
                          </li>
                        ))}
                        {inv.manual.map((l) => (
                          <li key={`m${l.id}`}>
                            {l.description} — {money(l.total)} <em>(manuel)</em>
                          </li>
                        ))}
                      </ul>
                    )}
                    <ManualInvoiceLineForm openInvoiceId={inv.id} contactId={inv.contactId} defaultOpen={false} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* KLAR TIL FAKTURERING — GRUPPERET PR. KUNDE (Thomas, 2026-09-17) */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h4 className="section-title" style={{ margin: 0 }}>
                Klar til fakturering ({customerGroups.length} {customerGroups.length === 1 ? "kunde" : "kunder"} · {ready.length} opgaver) — {money(totalReadySum)}
              </h4>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                Hver kunde modtager kun 1 samlet faktura. Flere opgaver til samme kunde samles automatisk.
              </p>
            </div>
          </div>
          <div className="card-body tight" style={{ padding: "12px" }}>
            {customerGroups.length === 0 ? (
              <div className="table-empty">Intet venter på fakturering 🎉</div>
            ) : (
              customerGroups.map((c) => (
                <div
                  key={c.contactId}
                  style={{
                    border: "1px solid var(--table-border, #e5e7eb)",
                    borderRadius: 8,
                    marginBottom: 14,
                    background: "#fff",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Kundehoved med kunde, type, totalbeløb og Fakturer nu-knap */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: c.orders.length > 1 ? "rgba(238, 242, 255, 0.6)" : "rgba(249, 250, 251, 0.8)",
                      borderBottom: "1px solid var(--table-border, #e5e7eb)",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <Link
                        href={`/customers/${c.contactId}`}
                        style={{ fontWeight: 600, fontSize: 15, color: "var(--heading, #111)" }}
                      >
                        {c.customer}
                      </Link>
                      <span className={c.isCompany ? "badge badge-soft-warning" : "badge badge-soft-success"} style={{ fontSize: 11.5 }}>
                        {c.sendRuleLabel}
                      </span>
                      <span style={{ fontSize: 12.5, color: "var(--muted, #6b7280)" }}>
                        <strong>{c.orders.length} {c.orders.length === 1 ? "opgave" : "opgaver"}</strong>
                        {c.manualLines.length > 0 ? ` + ${c.manualLines.length} manuel linje` : ""}
                        {" · "}
                        Leveret: {c.dateSummary}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--heading, #111)" }}>
                        {money(c.totalSum)}
                      </span>
                      {user.isAdmin ? (
                        <InvoiceNowButton
                          contactId={c.contactId}
                          label={c.orders.length > 1 ? `Fakturer kunden (${c.orders.length} opgaver)` : "Fakturer nu"}
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* Detaljer over opgaver og manuelle linjer under kunden */}
                  <div style={{ padding: "8px 14px 12px" }}>
                    <div className="table-wrap" style={{ overflowX: "auto" }}>
                      <table className="data-table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ textAlign: "left", color: "var(--table-header, #6b7280)", fontSize: 11.5 }}>
                            <th style={{ padding: "6px 8px", width: 140 }}>Ordre nr.</th>
                            <th style={{ padding: "6px 8px", width: 100 }}>Dato</th>
                            <th style={{ padding: "6px 8px" }}>Opgaver</th>
                            <th style={{ padding: "6px 8px", width: 140 }}>Medarbejder</th>
                            <th style={{ padding: "6px 8px", width: 90, textAlign: "right" }}>Pris</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.orders.map((o) => (
                            <tr key={o.id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                              <td className="num" style={{ padding: "6px 8px" }}>
                                <Link href={`/orders/${o.id}`}>#{o.id}</Link>
                                {" · "}
                                <Link href={`/calendar?week=${o.weekMonday}`} style={{ fontSize: 11, color: "var(--muted, #6b7280)" }}>
                                  kalender
                                </Link>
                              </td>
                              <td className="num" style={{ padding: "6px 8px" }}>{o.date}</td>
                              <td style={{ padding: "6px 8px" }}>
                                {o.tasks.map((t, i) => (
                                  <div key={i} style={{ margin: "2px 0" }}>
                                    <CatChip category={t.category} letter={t.letter} /> {t.description}
                                  </div>
                                ))}
                              </td>
                              <td style={{ padding: "6px 8px" }}>{o.employee}</td>
                              <td className="num" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>
                                {money(o.price)}
                              </td>
                            </tr>
                          ))}

                          {/* Manuelle linjer for denne kunde */}
                          {c.manualLines.map((l) => (
                            <tr key={`m-${l.id}`} style={{ background: "rgba(254, 243, 199, 0.35)", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                              <td colSpan={2} style={{ padding: "6px 8px", fontStyle: "italic", color: "var(--muted, #6b7280)", fontSize: 12 }}>
                                Manuel fakturalinje
                              </td>
                              <td colSpan={2} style={{ padding: "6px 8px" }}>
                                <strong>{l.description}</strong>
                                {l.quantity !== 1 ? ` (${l.quantity} stk. à ${money(l.priceInclVat)})` : ""}
                              </td>
                              <td className="num" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>
                                {money(l.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {c.orders.length > 1 || c.manualLines.length > 0 ? (
                          <tfoot>
                            <tr style={{ borderTop: "2px solid var(--table-border, #e5e7eb)", fontWeight: 600 }}>
                              <td colSpan={4} style={{ padding: "6px 8px", textAlign: "right" }}>
                                Samlet for {c.customer}:
                              </td>
                              <td className="num" style={{ padding: "6px 8px", textAlign: "right", fontSize: 14, fontWeight: 700 }}>
                                {money(c.totalSum)}
                              </td>
                            </tr>
                          </tfoot>
                        ) : null}
                      </table>
                    </div>

                    {/* Tilføj manuel fakturalinje til denne kunde */}
                    <ManualInvoiceLineForm contactId={c.contactId} openInvoiceId={c.openInvoiceId} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* IKKE MELDT FÆRDIGT */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h4 className="section-title">Ikke meldt færdigt ({notDone.length}) — {money(sum(notDone))}</h4>
          </div>
          <div className="card-body tight">
            <Table rows={notDone} empty="Ingen uafsluttede fortidsordrer." showNotDoneActions />
          </div>
        </div>

        {/* FAKTURERET / LUKKET */}
        <div className="card">
          <div className="card-header">
            <h4 className="section-title">Faktureret / lukket ({done.length}) — {money(sum(done))}</h4>
          </div>
          <div className="card-body tight">
            <Table rows={done} empty="Ingenting er faktureret endnu." />
          </div>
        </div>
      </div>
    </div>
  );
}
