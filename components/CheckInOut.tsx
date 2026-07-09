"use client";

// Felt-flade til tidsregistrering: én knap der skifter mellem Check ind / Check ud.
// Status kommer fra server-komponenten; server-action'en revalidate'r /daycalendar,
// så knappen opdaterer sig selv efter et klik (samme mønster som DayStopCard).
import { useTransition } from "react";
import { checkIn, checkOut } from "@/app/actions/timesheet";

export default function CheckInOut({ checkedIn, sinceLabel }: { checkedIn: boolean; sinceLabel: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-body tight" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <b>Arbejdstid</b>
        {checkedIn ? (
          <span className="badge badge-soft-success">Checket ind{sinceLabel ? ` kl. ${sinceLabel}` : ""}</span>
        ) : (
          <span className="badge badge-soft-muted">Ikke checket ind</span>
        )}
        <span style={{ flex: 1 }} />
        {checkedIn ? (
          <button type="button" className="btn btn-outline-primary" disabled={pending}
            onClick={() => start(() => checkOut())}>
            {pending ? "Vent…" : "Check ud"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={pending}
            onClick={() => start(() => checkIn())}>
            {pending ? "Vent…" : "Check ind"}
          </button>
        )}
      </div>
    </div>
  );
}
