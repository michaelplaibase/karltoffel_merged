"use client";

// Formular til manuel linje på en ÅBEN faktura (2026-09-15): beskrivelse +
// beløb (inkl. moms) + antal. Kalder server-actionen addManualInvoiceLine og
// viser pending-state og success/fejl inline — fejl ALDRIG stille (samme
// mønster som InvoiceNowButton).
import { useState, useTransition } from "react";
import { addManualInvoiceLine, type ManualLineResult } from "@/app/actions/invoice-manual";

export default function ManualInvoiceLineForm({ openInvoiceId }: { openInvoiceId: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ManualLineResult | null>(null);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  return (
    <form
      className="manual-invoice-line"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start", marginTop: 10 }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addManualInvoiceLine(openInvoiceId, description, Number(price), Number(quantity));
          setResult(res);
          if (res.ok) {
            setDescription("");
            setPrice("");
            setQuantity("1");
          }
        });
      }}
    >
      <input
        type="text"
        placeholder="Beskrivelse (fx varekøb)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        disabled={pending}
        style={{ flex: "2 1 200px", minWidth: 160, padding: "6px 10px" }}
      />
      <input
        type="number"
        placeholder="Beløb kr. inkl. moms"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
        min="0.01"
        step="0.01"
        inputMode="decimal"
        disabled={pending}
        style={{ flex: "1 1 130px", minWidth: 110, padding: "6px 10px" }}
      />
      <input
        type="number"
        placeholder="Antal"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
        min="0.01"
        step="0.01"
        inputMode="decimal"
        disabled={pending}
        style={{ flex: "0 1 80px", minWidth: 70, width: 80, padding: "6px 10px" }}
      />
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ padding: "6px 14px", whiteSpace: "nowrap" }}>
        {pending ? "Tilføjer…" : "Tilføj linje"}
      </button>
      {result ? (
        <div
          className="help-note"
          role="status"
          style={{ width: "100%", color: result.ok ? undefined : "#C4183C" }}
        >
          {result.ok ? result.message : result.error}
        </div>
      ) : null}
    </form>
  );
}
