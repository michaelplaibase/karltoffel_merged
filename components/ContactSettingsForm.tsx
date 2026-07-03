"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ContactFormState } from "@/app/actions/contacts";

const PRESET = [
  "Anvend standardindstilling",
  "Blank (ingen forudindstilling)",
  "Send faktura - ubetalt",
  "Send faktura - betalt kontant",
  "Send ikke faktura fra Fenster",
  "Opret fakturakladde",
  "Registrer på et senere tidspunkt",
];

const checkRow: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 300, marginTop: 6 };

export type ContactSettingsInitial = {
  skipDeliveryAddressOnInvoice: boolean;
  showDeliveryNameOnInvoice: boolean;
  skipInvoiceOverSms: boolean;
  invoiceChoicePreselect: string;
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
  const preset = PRESET.includes(initial.invoiceChoicePreselect) ? initial.invoiceChoicePreselect : PRESET[0];

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
            <small className="form-text field-help">Hvis markeret, så undlader Fenster at sende fakturaen via SMS, selvom SMS er valgt under generelle indstillinger. Det kan f.eks. bruges til erhvervskunder, der ikke ønsker SMS.</small>
          </div>
        </div>

        <div className="f2">
          <label>Forudindstilling for &apos;Betaling og fakturering&apos;</label>
          <div>
            {PRESET.map((p) => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 300, padding: "2px 0" }}>
                <input type="radio" name="invoiceChoicePreselect" value={p} defaultChecked={p === preset} /> {p}
              </label>
            ))}
            <small className="form-text field-help">Vælg hvordan sektionen &quot;Betaling og Fakturering&quot; på siden &quot;Afslut ordre&quot; skal forudindstilles for denne kunde. Indstillingen overskriver den generelle standardindstilling.</small>
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
