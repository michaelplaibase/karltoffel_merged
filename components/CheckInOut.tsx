"use client";

// Felt-flade til tidsregistrering: én knap der skifter mellem Check ind / Check ud.
// Status kommer fra server-komponenten; server-action'en revalidate'r /daycalendar,
// så knappen opdaterer sig selv efter et klik (samme mønster som DayStopCard).
//
// Glemt check-ud: detaljer om den åbne registrering hentes via getOpenEntryInfo,
// så badgen viser DATO når check-ind er fra en tidligere dansk kalenderdag —
// og en "Glemte du at tjekke ud?"-formular lukker vagten med en angivet sluttid
// på check-ind-dagen, i stedet for at en kæmpe-vagt frem til nu er eneste udvej.
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  checkIn, checkOut, checkOutAt, getOpenEntryInfo,
  type CheckOutAtState, type OpenEntryInfo,
} from "@/app/actions/timesheet";

export default function CheckInOut({ checkedIn, sinceLabel }: { checkedIn: boolean; sinceLabel: string | null }) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<OpenEntryInfo>(null);
  const [state, formAction, formPending] = useActionState<CheckOutAtState, FormData>(
    (p, fd) => checkOutAt(p, fd),
    {},
  );

  useEffect(() => {
    if (!checkedIn) return;
    let alive = true;
    getOpenEntryInfo().then((i) => { if (alive) setInfo(i); }).catch(() => {});
    return () => { alive = false; };
  }, [checkedIn]);

  // Afledt (ikke nulstillet i en effect): info gælder kun mens man er checket ind;
  // klik-handlerne rydder den, så et nyt check-ind aldrig viser en gammel dato.
  const shownInfo = checkedIn ? info : null;
  const glemt = checkedIn && shownInfo != null && !shownInfo.sammeDag;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-body tight" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <b>Arbejdstid</b>
        {checkedIn ? (
          <span className={glemt ? "badge badge-soft-warning" : "badge badge-soft-success"}>
            {shownInfo != null && !shownInfo.sammeDag
              ? `Checket ind ${shownInfo.dato} kl. ${shownInfo.tid}`
              : `Checket ind${sinceLabel ? ` kl. ${sinceLabel}` : ""}`}
          </span>
        ) : (
          <span className="badge badge-soft-muted">Ikke checket ind</span>
        )}
        <span style={{ flex: 1 }} />
        {checkedIn ? (
          <button type="button" className="btn btn-outline-primary" disabled={pending}
            onClick={() => { setInfo(null); start(() => checkOut()); }}>
            {pending ? "Vent…" : "Check ud"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={pending}
            onClick={() => { setInfo(null); start(() => checkIn()); }}>
            {pending ? "Vent…" : "Check ind"}
          </button>
        )}
        {glemt && (
          <form action={formAction} style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>Glemte du at tjekke ud {shownInfo.dato}? Angiv sluttid:</span>
            {/* React 19: state.values ekkoer indtastningen, så den overlever en valideringsfejl. */}
            <input type="time" name="tid" required defaultValue={state.values?.tid ?? ""}
              className="form-control form-control-sm" style={{ width: 110 }} />
            <button type="submit" className="btn btn-outline-primary btn-sm" disabled={formPending}>
              {formPending ? "Gemmer…" : "Gem sluttid"}
            </button>
            {state.error ? <span style={{ color: "var(--danger, #C4183C)" }}>{state.error}</span> : null}
          </form>
        )}
      </div>
    </div>
  );
}
