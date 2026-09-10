"use client";

// Hurtig "Tilføj ekstra opgave" på ordresiden (Thomas, 2026-09-10): kunden
// spørger om en ekstra opgave mens medarbejderen er der — taster titel + pris
// og trykker gem. Varighed beregnes automatisk fra minutprisen (timeberegneren).
// Tjek "Gem også i abonnement/fastprisaftale" → linjen følger med på alle
// fremtidige besøg; ellers kun på denne ordre.
import { useState, useTransition } from "react";
import { addOrderTask } from "@/app/actions/orders";

export default function AddOrderTaskForm({ orderId }: { orderId: number }) {
  const [pending, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [toAgreement, setToAgreement] = useState(false);

  const submit = () => {
    const d = desc.trim();
    const p = Number(price.replace(",", "."));
    if (!d || !Number.isFinite(p) || p <= 0) return;
    start(async () => {
      await addOrderTask(orderId, d, p, toAgreement);
      setDesc("");
      setPrice("");
      setToAgreement(false);
    });
  };

  const valid = desc.trim() !== "" && Number(price.replace(",", ".")) > 0;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
      <input
        className="form-control form-control-sm"
        style={{ flex: "2 1 220px", minWidth: 180 }}
        placeholder={'Ekstra opgave (fx "Vinduer udvendigt ekstra")'}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        disabled={pending}
      />
      <input
        className="form-control form-control-sm"
        style={{ flex: "1 1 110px", minWidth: 100, maxWidth: 150 }}
        inputMode="decimal"
        placeholder="Pris (kr)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        disabled={pending}
      />
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap" }}>
        <input
          type="checkbox"
          checked={toAgreement}
          onChange={(e) => setToAgreement(e.target.checked)}
          disabled={pending}
        />
        Gem også i abonnement/fastprisaftale
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending || !valid}
        onClick={submit}
        style={{ padding: "4px 14px", fontSize: 12.5 }}
      >
        {pending ? "Gemmer…" : "Tilføj"}
      </button>
    </div>
  );
}