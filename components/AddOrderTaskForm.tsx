"use client";

// Hurtig "Tilføj ekstra opgave" på ordresiden (Thomas, 2026-09-10): kunden
// spørger om en ekstra opgave mens medarbejderen er der — taster titel + pris
// og trykker gem. Varighed beregnes automatisk fra minutprisen (timeberegneren).
// To SEPARATE valg (Thomas 2026-09-10): ☐ Fastprisaftale (alle fremtidige
// besøg) eller ☐ Abonnement (med interval: hver gang / hver 2. gang / …).
// Ingen afkrydset = kun på denne ene ordre. Valgene følger hvad ordren kommer
// fra — serveren gemmer kun på den aftale ordren faktisk hører under.
import { useState, useTransition } from "react";
import { addOrderTask } from "@/app/actions/orders";

const INTERVALS = ["Hver gang", "Hver 2. gang", "Hver 3. gang", "Hver 4. gang", "Hver 5. gang"];

export default function AddOrderTaskForm({ orderId, hasSubscription, hasFixedPrice }: { orderId: number; hasSubscription: boolean; hasFixedPrice: boolean }) {
  const [pending, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [toFixed, setToFixed] = useState(false);
  const [toSub, setToSub] = useState(false);
  const [interval, setInterval] = useState(INTERVALS[0]);

  const submit = () => {
    const d = desc.trim();
    const p = Number(price.replace(",", "."));
    if (!d || !Number.isFinite(p) || p <= 0) return;
    if (!toFixed && !toSub) return;
    start(async () => {
      await addOrderTask(orderId, d, p, toFixed, toSub, interval);
      setDesc("");
      setPrice("");
      setToFixed(false);
      setToSub(false);
      setInterval(INTERVALS[0]);
    });
  };

  const valid = desc.trim() !== "" && Number(price.replace(",", ".")) > 0 && (toFixed || toSub);

  return (
    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 13 }}>
        {hasFixedPrice ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={toFixed} onChange={(e) => setToFixed(e.target.checked)} disabled={pending} />
            Gem i fastprisaftale (alle fremtidige besøg)
          </label>
        ) : null}
        {hasSubscription ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={toSub} onChange={(e) => setToSub(e.target.checked)} disabled={pending} />
            Gem i abonnement
          </label>
        ) : null}
        {toSub ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            Hvor ofte:
            <select
              className="form-select form-select-sm"
              style={{ width: "auto" }}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              disabled={pending}
            >
              {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        ) : null}
        {!toFixed && !toSub ? (
          <span style={{ color: "#8a6931", fontSize: 12.5 }}>
            {hasSubscription || hasFixedPrice
              ? "Ingen afkrydsning = opgaven gælder kun denne ordre."
              : "Ingen abonnement/fastprisaftale på denne ordre — opgaven gælder kun denne ordre."}
          </span>
        ) : null}
      </div>
    </div>
  );
}