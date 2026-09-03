"use client";

import { useActionState, useEffect, useState } from "react";
import { invoiceAll, countReady, type InvoiceAllState } from "@/app/actions/invoice-all";

// "Fakturér alle"-knap (Michael, 2026-09-03): overrider alle afsendelsesregler
// og sender alle klar-til-fakturering ordrer MED DET SAME — privat og erhverv.
// Dobbeltsikring: første tryk viser en bekræftelsesdialog ("Er du sikker?") med
// antal ordrer/kunder; faktureringen starter FØRST ved andet tryk.
const INITIAL: InvoiceAllState = {
  ok: true, contacts: 0, invoiced: 0, simulated: 0, skippedNoDecision: 0,
  failed: 0, totalInclVat: 0, errors: [],
};

export default function InvoiceAllButton() {
  const [confirming, setConfirming] = useState(false);
  const [counts, setCounts] = useState<{ orders: number; contacts: number } | null>(null);

  const [state, formAction, pending] = useActionState<InvoiceAllState, FormData>(
    async (prev, fd) => {
      void prev; void fd;
      return invoiceAll(prev, fd);
    },
    INITIAL,
  );

  // Luk bekræftelsen automatisk når kørslen er færdig (pending faldt til false
  // efter en faktisk kørsel), så resultatet vises direkte under knappen.
  useEffect(() => {
    if (state.contacts > 0 || state.invoiced > 0 || state.simulated > 0) setConfirming(false);
  }, [state]);

  async function openConfirm() {
    setConfirming(true);
    setCounts(await countReady());
  }

  const busy = pending;

  return (
    <div style={{ marginBottom: 16 }}>
      {!confirming ? (
        <button type="button" className="btn btn-danger" onClick={openConfirm} disabled={busy}>
          Fakturér alle
        </button>
      ) : (
        <div className="card" style={{ borderColor: "var(--danger)", borderWidth: 2, maxWidth: 560 }}>
          <div className="card-body">
            <b>Er du sikker?</b>
            <p className="page-desc" style={{ marginTop: 6 }}>
              Dette sender rigtige fakturaer <b>med det samme</b> til alle kunder, der
              venter på faktura — både privat- og erhvervskunder, og selvom fakturaen
              ellers først ville gå ud på det normale tidspunkt (pr. gang / måned / kvartal).
            </p>
            <p className="page-desc" style={{ marginTop: 4 }}>
              {counts
                ? <>Der venter <b>{counts.orders} {counts.orders === 1 ? "ordre" : "ordrer"}</b> fordelt på <b>{counts.contacts} {counts.contacts === 1 ? "kunde" : "kunder"}</b>.</>
                : "Tæller ordrer…"}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <form action={formAction}>
                <button type="submit" className="btn btn-danger" disabled={busy}>
                  {busy ? "Fakturerer… (lad siden stå åben)" : "Ja, send alle fakturaer nu"}
                </button>
              </form>
              <button type="button" className="btn btn-light" onClick={() => setConfirming(false)} disabled={busy}>
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}

      {state.empty ? (
        <div className="help-note" style={{ marginTop: 8 }}>
          Intet at fakturere — alt er allerede sendt eller venter ikke på faktura. 🎉
        </div>
      ) : state.invoiced > 0 || state.simulated > 0 || state.failed > 0 ? (
        <div className="help-note" style={{ marginTop: 8 }}>
          {state.invoiced > 0 && <>✅ {state.invoiced} kunder faktureret og afsendt ({(state.totalInclVat / 100).toLocaleString("da-DK")} kr i alt).<br /></>}
          {state.simulated > 0 && <>🧪 {state.simulated} kunder simuleret (Dinero ikke aktiveret — intet sendt).<br /></>}
          {state.skippedNoDecision > 0 && <>⏭️ {state.skippedNoDecision} ordrer sprunget over (valgt &quot;ingen faktura&quot;/&quot;senere&quot;).<br /></>}
          {state.failed > 0 && <>⚠️ {state.failed} fejlede:<ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {state.errors.map((e, i) => <li key={i}>{e.customer}: {e.error}</li>)}
          </ul></>}
        </div>
      ) : null}
    </div>
  );
}
