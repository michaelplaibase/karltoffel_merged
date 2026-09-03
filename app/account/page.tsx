import Link from "next/link";
import { prisma } from "@/lib/db";
import SettingsButtons from "@/components/SettingsButtons";
import { logout } from "@/app/actions/auth";

export const metadata = { title: "Konto · Karltoffel Business Manager" };

export default async function AccountPage() {
  const company = await prisma.company.findFirst();
  const subs = await prisma.subscription.count({ where: { active: true } });
  const rows: [string, string][] = [
    ["Virksomhed", company?.name ?? "—"],
    ["CVR", company?.cvr ?? "—"],
    ["Telefon", company?.phone ?? "—"],
    ["E-mail", company?.email ?? "—"],
  ];

  return (
    <div className="container-1140" style={{ maxWidth: 820 }}>
      <h1 className="page-title">Din konto</h1>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Virksomhedsoplysninger</h4>
          <div className="table-wrap">
            <table className="data-table"><tbody>
              {rows.map(([k, v]) => <tr key={k}><td style={{ width: 220, color: "var(--muted)" }}>{k}</td><td>{v}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Forbrug</h4>
          <div className="kpigrid">
            <div className="kpi"><div className="k">{subs}</div><div className="t">Aktive abonnementer</div></div>
            <div className="kpi"><div className="k">Intern</div><div className="t">Licenstype</div><div className="s">Intern klon — ingen plan-tier</div></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Fakturering</h4>
          <p className="muted" style={{ marginBottom: 12 }}>Betalings- og faktureringsoplysninger administreres eksternt.</p>
          <SettingsButtons btns={[["Åbn betalingsportal ...", "outline-primary"], ["Se fakturahistorik ...", "light"]]} />
        </div>
      </div>

      <div className="row-actions">
        <Link href="/change-password" className="btn btn-light">Skift password</Link>
        <form action={logout}><button type="submit" className="btn btn-outline-secondary">Log ud</button></form>
      </div>
    </div>
  );
}
