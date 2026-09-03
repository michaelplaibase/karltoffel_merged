"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ContactFormState } from "@/app/actions/contacts";

// Faktureringsregel pr. kunde (Thomas, 2026-09-03). ''/'auto' = afled af
// isCompany (privat → pr. gang, erhverv → pr. måned).
const FREQUENCY = [
  { value: "", label: "Automatisk (privat: pr. gang · erhverv: pr. måned)" },
  { value: "pr_gang", label: "Faktura pr. gang (sendes automatisk kl. 23 hver aften)" },
  { value: "maaned", label: "Faktura pr. måned (samles og sendes automatisk den 20.)" },
  { value: "kvartal", label: "Faktura pr. kvartal (samles og sendes automatisk den 20. efter kvartalet)" },
];
const freqOf = (v: string) => (FREQUENCY.some((f) => f.value === v) ? v : "");

const checkRow: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 300, marginTop: 6 };

export type ContactSettingsInitial = {
  skipDeliveryAddressOnInvoice: boolean;
  showDeliveryNameOnInvoice: boolean;
  skipInvoiceOverSms: boolean;
  invoiceChoicePreselect: string;
  invoiceFrequency: string;
};

export default function ContactSettingsForm({
  action, name, initial, cancelHref,
}: {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  name: string;
  initial: ContactSettingsInitial;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const freq = freqOf(initial.invoiceFrequency);

  return (
    <form action={formAction} className="card form-card">
      <div className="card-header header-primary">
        <h3>Rediger indstillinger for {name}</h3>
      </div>
      <div className="card-body">
        <div className="f2">
          <label>Fjern leveringsadresse fra fakturalinje</label>
          <div>
            <label style={checkRow}>
              <input type="checkbox" name="skipDeliveryAddressOnInvoice" defaultChecked={initial.skipDeliveryAddressOnInvoice} /> Ja
            </label>
            <small className="form-text field-help">Hvis markeret, så fjernes leveringsadressen fra fakturalinjen, hvor den normalt bliver vist sammen med ordrenummer og leveringsdato.</small>
          </div>
        </div>

        <div className="f2">
          <label>Tilføj leverings-kontaktnavn til fakturalinje</label>
          <div>
            <label style={checkRow}>
              <input type="checkbox" name="showDeliveryNameOnInvoice" defaultChecked={initial.showDeliveryNameOnInvoice} /> Ja
            </label>
            <small className="form-text field-help">Hvis markeret, så tilføjes leveringskontaktens navn til fakturalinjen, så den bliver vist sammen med ordrenummer, leveringsdato og leveringsadresse.</small>
          </div>
        </div>

        <div className="f2">
          <label>Undlad at sende faktura via SMS</label>
          <div>
            <label style={checkRow}>
              <input type="checkbox" name="skipInvoiceOverSms" defaultChecked={initial.skipInvoiceOverSms} /> Send ikke via SMS
            </label>
            <small className="form-text field-help">Hvis markeret, så undlader Karltoffel at sende fakturaen via SMS, selvom SMS er valgt under generelle indstillinger. Det kan f.eks. bruges til erhvervskunder, der ikke ønsker SMS.</small>
          </div>
        </div>

        <div className="f2">
          <label>Faktureringsregel</label>
          <div>
            {FREQUENCY.map((f) => (
              <label key={f.value || "auto"} style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 300, padding: "2px 0" }}>
                <input type="radio" name="invoiceFrequency" value={f.value} defaultChecked={f.value === freq} /> {f.label}
              </label>
            ))}
            <small className="form-text field-help">Hvornår skal kundens fakturaer sendes automatisk? &quot;Automatisk&quot; betyder: privatkunder faktureres pr. gang, erhvervskunder samles pr. måned (sendes den 20.).</small>
          </div>
        </div>

        {state.error && <div style={{ color: "#c0392b", fontSize: 13 }}>{state.error}</div>}

        <div className="savebar">
          <Link href={cancelHref} className="btn btn-light">Luk</Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Gemmer…" : "Gem kontaktindstillinger"}
          </button>
        </div>
      </div>
    </form>
  );
}
