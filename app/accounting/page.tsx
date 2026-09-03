// Regnskab — Dinero (Visma) integration status + connection test + kontoplan.
// Auth is a Dinero Personal API Client (client_credentials): credentials live in the
// environment, so there is no connect/consent flow — just a status view, a "Test
// forbindelse" button, and the chart-of-accounts numbers. Admin only.
import { getSessionUser } from "@/lib/api-auth";
import { getDineroStatus } from "@/lib/dinero";
import DineroAccountsForm from "@/components/DineroAccountsForm";
import DineroTestButton from "@/components/DineroTestButton";
import { redirect } from "next/navigation";

export const metadata = { title: "Regnskab · Karltoffel" };

export default async function AccountingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!user.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 760 }}>
        <h1 className="page-title">Regnskab</h1>
        <div className="card"><div className="card-body">
          <div className="help-note">Kun administratorer har adgang til regnskabsindstillinger.</div>
        </div></div>
      </div>
    );
  }

  const { envReady, dryRunForced, orgId, connection } = await getDineroStatus();

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">Regnskab</h1>
      <p className="page-desc" style={{ marginTop: 4 }}>
        Karltoffel bruger en Dinero API-klient til at udstede og bogføre fakturaer automatisk, når du afslutter en ordre.
      </p>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Dinero integration</h4></div>
        <div className="card-body tight">
          {!envReady ? (
            <div className="help-note">
              Dinero er <b>ikke konfigureret</b>. Sæt <code>DINERO_CLIENT_ID</code> og <code>DINERO_CLIENT_SECRET</code>{" "}
              (Dinero Personal API Client) i miljøet — se <code>.env.example</code> — og deploy igen. Indtil da simuleres
              al fakturering (intet sendes til Dinero).
            </div>
          ) : (
            <>
              {dryRunForced ? (
                <div className="help-note" style={{ marginBottom: 12 }}>
                  <b>Dry-run er slået til</b> (<code>DINERO_DRY_RUN=1</code>): fakturering simuleres. Fjern flaget i
                  produktion for at udstede rigtige fakturaer.
                </div>
              ) : null}
              {!orgId ? (
                <div className="help-note" style={{ color: "var(--danger, #C4183C)", marginBottom: 12 }}>
                  Kunne ikke udlede organisations-ID af client-id&apos;et (forventet <code>pcc_&lt;id&gt;_...</code>). Sæt{" "}
                  <code>DINERO_ORG_ID</code> eksplicit.
                </div>
              ) : null}
              <div className="form-static">
                <b>Organisations-ID</b>{"\n"}{connection?.organizationId || orgId || "—"}{"\n\n"}
                <b>Firmanavn</b>{"\n"}{connection?.orgName ?? "— (kør Test forbindelse)"}{"\n\n"}
                <b>Dinero Pro</b>{"\n"}{connection ? (connection.isPro ? "Ja" : "Nej (API kræver Pro)") : "—"}{"\n\n"}
                <b>Status</b>{"\n"}{connection?.status === "error" ? "Fejl ved seneste test" : connection ? "Verificeret" : "Ikke testet endnu"}
              </div>
              <div style={{ marginTop: 14 }}><DineroTestButton /></div>
            </>
          )}
        </div>
      </div>

      {envReady ? (
        <div className="card">
          <div className="card-header"><h4 className="section-title">Dinero kontoplan</h4></div>
          <div className="card-body tight">
            <p className="muted" style={{ margin: "0 0 10px" }}>
              Kontonumre fra din Dinero kontoplan, som Karltoffel bogfører på.
            </p>
            <DineroAccountsForm
              salesAccountNumber={connection?.salesAccountNumber ?? 1000}
              cashAccountNumber={connection?.cashAccountNumber ?? 55040}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
