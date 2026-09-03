"use client";

// "Fakturer nu"-knap pr. ordre i Klar til fakturering (Thomas, 2026-09-03).
// Kalder server-actionen invoiceNow (samme Dinero-flow som "Fakturér igen"),
// viser pending-state og success/fejl inline — fejl ALDRIG stille.
import { useState, useTransition } from "react";
import { invoiceNow, type InvoiceNowResult } from "@/app/actions/dinero";

export default function InvoiceNowButton({ orderId }: { orderId: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<InvoiceNowResult | null>(null);

  return (
    <span style={{ display: "inline-block" }}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        style={{ padding: "4px 10px", fontSize: 12.5, whiteSpace: "nowrap" }}
        onClick={() =>
          start(async () => {
            const res = await invoiceNow(orderId);
            setResult(res);
          })
        }
      >
        {pending ? "Fakturerer…" : "Fakturer nu"}
      </button>
      {result ? (
        <div
          className="help-note"
          role="status"
          style={{ marginTop: 6, maxWidth: 240, whiteSpace: "normal", color: result.ok ? undefined : "#C4183C" }}
        >
          {result.ok ? result.message : result.error}
        </div>
      ) : null}
    </span>
  );
}
