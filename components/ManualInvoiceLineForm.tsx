"use client";

// Formular til manuel linje på en kunde/faktura (2026-09-15 / 2026-09-17):
// beskrivelse + beløb (inkl. moms) + antal. Kalder server-actionen addManualInvoiceLine
// og viser pending-state og success/fejl inline — fejl ALDRIG stille.
import { useState, useTransition } from "react";
import { addManualInvoiceLine, type ManualLineResult } from "@/app/actions/invoice-manual";

export default function ManualInvoiceLineForm({
  openInvoiceId,
  contactId,
  defaultOpen = false,
}: {
  openInvoiceId?: number;
  contactId?: number;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ManualLineResult | null>(null);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  const target = openInvoiceId ?? (contactId ? { contactId } : 0);

  if (!isOpen) {
    return (
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            background: "transparent",
            border: "1px dashed var(--border, #d1d5db)",
            borderRadius: 4,
            padding: "3px 8px",
            fontSize: 12,
            color: "var(--muted, #6b7280)",
            cursor: "pointer",
          }}
        >
          + Tilføj manuel linje (fx varekøb)
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(0,0,0,0.02)", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted, #6b7280)" }}>
          Manuel fakturalinje (fx varekøb kunden skal betale)
        </span>
        {!defaultOpen ? (
          <button
            type="button"
            onClick={() => { setIsOpen(false); setResult(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "var(--muted, #6b7280)" }}
          >
            Luk
          </button>
        ) : null}
      </div>
      <form
        className="manual-invoice-line"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addManualInvoiceLine(target, description, Number(price), Number(quantity));
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
          style={{ flex: "2 1 180px", minWidth: 150, padding: "5px 8px", fontSize: 12.5 }}
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
          style={{ flex: "1 1 120px", minWidth: 100, padding: "5px 8px", fontSize: 12.5 }}
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
          style={{ flex: "0 1 70px", minWidth: 60, width: 70, padding: "5px 8px", fontSize: 12.5 }}
        />
        <button type="submit" className="btn btn-primary" disabled={pending} style={{ padding: "5px 12px", fontSize: 12.5, whiteSpace: "nowrap" }}>
          {pending ? "Tilføjer…" : "Tilføj linje"}
        </button>
        {result ? (
          <div
            className="help-note"
            role="status"
            style={{ width: "100%", marginTop: 4, color: result.ok ? "#2e7d32" : "#C4183C" }}
          >
            {result.ok ? result.message : result.error}
          </div>
        ) : null}
      </form>
    </div>
  );
}
