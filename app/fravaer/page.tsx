import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { RegisterForm } from "@/components/AbsenceRegisterForm";
import { PendingQueue, RegisterForEmployee } from "@/components/AbsenceAdmin";

export const metadata = { title: "Fravær · Karltoffel Business Manager" };
export const dynamic = "force-dynamic";

const fmtDato = (d: Date) =>
  new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function FravaerPage() {
  const me = await getSessionUser();
  if (me == null) redirect("/login");

  // Historik: admin ser alle, medarbejder ser egne.
  const rows = await prisma.absence.findMany({
    where: me.isAdmin ? {} : { userId: me.id },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { user: { select: { firstName: true, lastName: true } } },
    take: 200,
  });

  const STATUS_LABEL: Record<string, string> = {
    registered: "Registreret",
    pending: "Venter på godkendelse",
    approved: "Godkendt",
    rejected: "Afvist",
  };
  const TYPE_LABEL: Record<string, string> = { sygdom: "Sygdom", ferie: "Ferie" };

  const pending = rows
    .filter((r) => r.status === "pending")
    .map((r) => ({
      id: r.id,
      navn: `${r.user.firstName} ${r.user.lastName}`.trim(),
      type: TYPE_LABEL[r.type] ?? r.type,
      dateISO: iso(r.date),
      dato: fmtDato(r.date),
      note: r.note,
    }));

  const employees = me.isAdmin
    ? (await prisma.user.findMany({ where: { active: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true } }))
        .map((u) => ({ id: u.id, navn: `${u.firstName} ${u.lastName}`.trim() }))
    : [];

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">Fravær</h1>
      <p className="page-desc">
        Sygdom gælder straks — opgaver for dagen flyttes automatisk til en anden dag, og kontoret får en e-mail.
        Ferie er en ansøgning: den planlægger kalenderen, når kontoret har godkendt den.
      </p>

      {me.isAdmin && <PendingQueue items={pending} />}
      <RegisterForm isAdmin={me.isAdmin} />
      {me.isAdmin && employees.length > 0 && <RegisterForEmployee employees={employees} />}

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">{me.isAdmin ? "Fraværshistorik (alle medarbejdere)" : "Min fraværshistorik"}</h4>
          {rows.length === 0 ? (
            <div className="table-empty">Ingen fraværsregistreringer endnu</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Medarbejder</th><th>Type</th><th>Dato</th><th>Status</th><th>Besked</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{`${r.user.firstName} ${r.user.lastName}`.trim()}</td>
                      <td>{TYPE_LABEL[r.type] ?? r.type}</td>
                      <td>{fmtDato(r.date)}</td>
                      <td>
                        {r.status === "approved" ? (
                          <span className="badge badge-soft-success">Godkendt</span>
                        ) : r.status === "rejected" ? (
                          <span className="badge badge-soft-danger">Afvist</span>
                        ) : r.status === "pending" ? (
                          <span className="badge badge-soft-warning">Venter på godkendelse</span>
                        ) : (
                          <span className="badge badge-soft-muted">Registreret</span>
                        )}
                      </td>
                      <td>{r.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
