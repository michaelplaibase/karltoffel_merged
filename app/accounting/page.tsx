// Regnskab — Dinero (Visma) integration status + connect/disconnect + kontoplan.
// Mirrors the old Fenster /dinero_settings page. Admin only.
import { getSessionUser } from "@/lib/api-auth";
import { getDineroStatus } from "@/lib/dinero";
import { disconnectDinero } from "@/app/actions/dinero";
import DineroAccountsForm from "@/components/DineroAccountsForm";
import ConfirmButton from "@/components/ConfirmButton";
import { redirect } from "next/navigation";

export const metadata = { title: "Regnskab · Karltoffel" };

const FEJL: Record<string, string> = {
  admin: "Kun administratorer kan forbinde til Dinero.",
  config: "Dinero er ikke konfigureret (DINERO_CLIENT_ID/SECRET/TOKEN_ENC_KEY mangler).",
  state: "Sikkerhedskontrollen (state) fejlede eller udløb. Prøv at forbinde igen.",
};

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fejl?: string }>;
}) {
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

  const { ok, fejl } = await searchParams;
  const { envReady, dryRunForced, connection } = await getDineroStatus();
  const broken = connection?.status === "broken";

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">Regnskab</h1>
      <p className="page-desc" style={{ marginTop: 4 }}>
        Forbind Karltoffel til Dinero, så fakturaer udstedes og bogføres automatisk, når du afslutter en ordre.
      </p>

      {ok ? <div className="help-note" style={{ color: "var(--success, #2e7d32)" }}>Forbundet til Dinero.</div> : null}
      {fejl ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{FEJL[fejl] ?? decodeURIComponent(fejl)}</div> : null}

      <div className="card">
        <div className="card-header"><h4 className="section-title">Dinero integration</h4></div>
        <div className="card-body tight">
          {!envReady ? (
            <div className="help-note">
              Dinero er <b>ikke konfigureret</b>. Sæt <code>DINERO_CLIENT_ID</code>, <code>DINERO_CLIENT_SECRET</code> og{" "}
              <code>DINERO_TOKEN_ENC_KEY</code> i miljøet (se <code>.env.example</code>), og deploy igen. Indtil da
              simuleres al fakturering (intet sendes til Dinero).
            </div>
          ) : !connection ? (
            <>
              <div className="help-note" style={{ marginBottom: 12 }}>
                Ingen Dinero-organisation er forbundet endnu. Klik nedenfor og godkend adgangen hos Visma Connect.
              </div>
              <form action="/api/dinero/connect" method="get">
                <button type="submit" className="btn btn-primary">Forbind til Dinero</button>
              </form>
            </>
          ) : (
            <>
              {broken ? (
                <div className="help-note" style={{ color: "var(--danger, #C4183C)", marginBottom: 12 }}>
                  Forbindelsen er udløbet og skal fornyes. Klik <b>Forbind til Dinero igen</b>.
                </div>
              ) : null}
              {dryRunForced ? (
                <div className="help-note" style={{ marginBottom: 12 }}>
                  <b>Dry-run er slået til</b> (<code>DINERO_DRY_RUN=1</code>): fakturering simuleres, selvom der er forbundet.
                  Fjern flaget i produktion for at udstede rigtige fakturaer.
                </div>
              ) : null}
              <div className="form-static">
                <b>Dinero firma-ID</b>{"\n"}{connection.organizationId}{"\n\n"}
                <b>Firmanavn</b>{"\n"}{connection.orgName ?? "—"}{"\n\n"}
                <b>Dinero Pro</b>{"\n"}{connection.isPro ? "Ja" : "Nej (API kræver Pro)"}{"\n\n"}
                <b>Status</b>{"\n"}{broken ? "Udløbet — skal genforbindes" : "Forbundet"}
              </div>
              <div className="row-actions" style={{ marginTop: 14 }}>
                <form action="/api/dinero/connect" method="get">
                  <button type="submit" className="btn btn-outline-primary">
                    {broken ? "Forbind til Dinero igen" : "Genopfrisk forbindelsen"}
                  </button>
                </form>
                <ConfirmButton
                  action={disconnectDinero}
                  label="Fjern forbindelsen"
                  title="Fjern Dinero-forbindelsen?"
                  body="Karltoffel vil ikke længere kunne udstede eller bogføre fakturaer i Dinero, før du forbinder igen."
                  confirmLabel="Fjern forbindelsen"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {connection ? (
        <div className="card">
          <div className="card-header"><h4 className="section-title">Dinero kontoplan</h4></div>
          <div className="card-body tight">
            <p className="muted" style={{ margin: "0 0 10px" }}>
              Kontonumre fra din Dinero kontoplan, som Karltoffel bogfører på.
            </p>
            <DineroAccountsForm
              salesAccountNumber={connection.salesAccountNumber}
              cashAccountNumber={connection.cashAccountNumber}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
