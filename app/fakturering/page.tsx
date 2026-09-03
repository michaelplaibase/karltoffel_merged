// Faktureringsoverblik (Thomas, 2026-09-02): ét samlet sted der viser, hvad der
// er meldt færdigt og venter på fakturering, hvad der allerede er faktureret,
// og hvad der IKKE er meldt færdigt endnu — så intet "forsvinder" mellem
// afslutning og faktura. Ren læseside: ingen skrivning, kun links videre til
// ordren (hvor datoen kan rykkes) og til kalenderugen.
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

export const metadata = { title: "Faktureringsoverblik · Karltoffel" };

// Lukkede statusser, invoiceLabel og invoiceTone er flyttet til
// lib/invoice-status.ts, så den daglige faktura-rapport deler samme logik.

/** UTC-dato som "YYYY-MM-DD" (samme konvention som lib/queries.ts ymd). */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Row = {
  id: number; contactId: number; customer: string; date: string;
  employee: string; price: number; status: string; weekMonday: string;
  invoice: string | null; // kort faktura-status eller null = ingen faktura
  invoiceTone: "red" | "yellow" | "green" | null; // farven på faktura-kolonnen
  tasks: { category: string; letter: string; description: string }[];
};

// invoiceTone og invoiceLabel: se lib/invoice-status.ts (delt med den daglige
// faktura-rapport).

async function loadRows(): Promise<Row[]> {
  // Fortids-ordrer er det der interesserer faktureringen; fremtidige ordrer er
  // ikke leveret endnu og kan ikke være klar til faktura.
  const today = new Date(`${todayCphISO()}T00:00:00.000Z`);
  const rows = await prisma.order.findMany({
    where: { plannedAt: { lt: today } },
    include: { tasks: true, employee: true, contact: true },
    orderBy: { plannedAt: "desc" },
    take: 500,
  });
  return rows.map((o) => {
    // plannedAt er gemt som UTC-middag — ugens mandag findes med samme
    // konvention som lib/queries.ts mondayISOOf.
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
      tasks: [...o.tasks].sort((a, b) => a.sort - b.sort)
        .map((t) => ({ category: t.category, letter: t.letter, description: t.description })),
    };
  });
}

function Table({ rows, empty, showInvoiceNow = false }: { rows: Row[]; empty: string; showInvoiceNow?: boolean }) {
  if (rows.length === 0) return <div className="table-empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ordre nr.</th><th>Kunde</th><th>Leverings-dato</th><th>Opgaver</th>
            <th>Pris</th><th>Medarbejder</th><th>Status</th><th>Faktura</th>
            {showInvoiceNow ? <th>Fakturer</th> : null}
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
              <td><Link href={`/customers/${o.contactId}`}>{o.customer}</Link></td>
              <td className="num">{o.date}</td>
              <td>{o.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
              <td className="num">{money(o.price)}</td>
              <td>{o.employee}</td>
              <td>{o.status}</td>
              <td>{o.invoiceTone === "green" ? <span className="badge badge-soft-success">{o.invoice}</span>
                : o.invoiceTone === "yellow" ? <span className="badge badge-soft-warning">{o.invoice}</span>
                : o.invoiceTone === "red" ? <span className="badge badge-soft-danger">{o.invoice}</span>
                : <span className="badge badge-soft-danger">Faktura ikke afsendt</span>}</td>
              {showInvoiceNow ? (
                <td><InvoiceNowButton orderId={o.id} /></td>
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
  //    (inkl. "Ingen faktura (valgt)"), så intet lukket er usynligt.
  const done = rows.filter((o) => o.invoice !== null);
  // 3) IKKE meldt færdigt: fortidsordre der hverken er Udført, Afsluttet eller
  //    Sprunget over — det Thomas skal rykke/planlægge færdig.
  const notDone = rows.filter((o) => !CLOSED.has(o.status));
  const sum = (rs: Row[]) => rs.reduce((a, o) => a + o.price, 0);

  return (
    <div className="container-1140 container-wide">
      <h1 className="page-title">Faktureringsoverblik</h1>
      <p className="page-desc">
        Alt der er meldt færdigt og venter på faktura, alt der allerede er faktureret,
        og alt der endnu ikke er meldt færdigt. Åbn en ordre for at rykke dens dato.
      </p>

      <div>
          <VerifyInvoicingButton />

<CleanupDescriptionsButton />

      {/* "Fakturér alle" (Michael, 2026-09-03): sender alle klar-til-faktura
          ordrer med det samme, med "Er du sikker?"-bekræftelse. */}
      <InvoiceAllButton />

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h4 className="section-title">Klar til fakturering ({ready.length}) — {money(sum(ready))}</h4></div>
            <div className="card-body tight"><Table rows={ready} empty="Intet venter på fakturering 🎉" showInvoiceNow={user.isAdmin} /></div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h4 className="section-title">Ikke meldt færdigt ({notDone.length}) — {money(sum(notDone))}</h4></div>
            <div className="card-body tight"><Table rows={notDone} empty="Ingen uafsluttede fortidsordrer." /></div>
          </div>

          <div className="card">
            <div className="card-header"><h4 className="section-title">Faktureret / lukket ({done.length}) — {money(sum(done))}</h4></div>
            <div className="card-body tight"><Table rows={done} empty="Ingenting er faktureret endnu." /></div>
          </div>
      </div>
    </div>
  );
}
