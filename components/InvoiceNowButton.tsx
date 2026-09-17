"use client";

// "Fakturer nu"-knap i Faktureringsoverblikket (Thomas, 2026-09-03 / 2026-09-17).
// Kan fakturere en hel kunde (alle kundens opgaver samlet) eller en enkelt ordre.
// Viser pending-state og success/fejl inline — fejl ALDRIG stille.
import { useState, useTransition } from "react";
import { invoiceNow, invoiceCustomerNow, type InvoiceNowResult } from "@/app/actions/dinero";

export default function InvoiceNowButton({
  orderId,
  contactId,
  label = "Fakturer nu",
}: {
  orderId?: number;
  contactId?: number;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<InvoiceNowResult | null>(null);

  const btnText = pending ? "Fakturerer…" : label;

  return (
    <span style={{ display: "inline-block" }}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        style={{ padding: "4px 10px", fontSize: 12.5, whiteSpace: "nowrap", fontWeight: 500 }}
        onClick={() =>
          start(async () => {
            let res: InvoiceNowResult;
            if (contactId != null) {
              res = await invoiceCustomerNow(contactId);
            } else if (orderId != null) {
              res = await invoiceNow(orderId);
            } else {
              res = { ok: false, error: "Hverken ordre eller kunde angivet." };
            }
            setResult(res);
          })
        }
      >
        {btnText}
      </button>
      {result ? (
        <div
          className="help-note"
          role="status"
          style={{ marginTop: 6, maxWidth: 280, whiteSpace: "normal", color: result.ok ? "#2e7d32" : "#C4183C" }}
        >
          {result.ok ? result.message : result.error}
        </div>
      ) : null}
    </span>
  );
}
