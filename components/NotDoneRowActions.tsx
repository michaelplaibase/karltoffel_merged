"use client";

// To rydde-op-knapper i "Ikke meldt færdigt"-tabellen på /fakturering
// (Thomas, 2026-09-08): "Meld færdig" sætter status til Udført (ordren ryger
// i Klar til fakturering), "Slet" sletter ordren (med tombstone for
// abonnements-ordrer, via deleteOrder). Begge med bekræftelse, hvor det
// giver mening — sletning kan ikke fortrydes.
import { useTransition } from "react";
import { markOrderDone } from "@/app/actions/orders";
import { deleteOrder } from "@/app/actions/orders";

export default function NotDoneRowActions({ orderId }: { orderId: number }) {
  const [pending, start] = useTransition();

  return (
    <span style={{ display: "inline-flex", gap: 6, whiteSpace: "nowrap" }}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        style={{ padding: "4px 10px", fontSize: 12.5 }}
        onClick={() => start(async () => { await markOrderDone(orderId); })}
      >
        {pending ? "…" : "Meld færdig"}
      </button>
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        style={{ padding: "4px 10px", fontSize: 12.5 }}
        onClick={() => {
          if (!window.confirm("Slet ordren? Det kan ikke fortrydes.")) return;
          start(async () => { await deleteOrder(orderId, null); });
        }}
      >
        Slet
      </button>
    </span>
  );
}
