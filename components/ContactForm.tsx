"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ContactFormState } from "@/app/actions/contacts";
import AddressFinder from "@/components/AddressFinder";

export type ContactInitial = {
  isCompany: boolean; companyName: string; cvr: string; ean: string;
  name: string; att: string; email: string; phone: string; address: string; note: string;
};

const EMPTY: ContactInitial = {
  isCompany: false, companyName: "", cvr: "", ean: "",
  name: "", att: "", email: "", phone: "", address: "", note: "",
};

export default function ContactForm({
  action, initial = EMPTY, title, submitLabel, cancelHref,
}: {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  initial?: ContactInitial;
  title: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [isCompany, setIsCompany] = useState(initial.isCompany);
  const [state, formAction, pending] = useActionState(action, {});
  // Ved en valideringsfejl nulstiller React 19 de ukontrollerede felter, så
  // defaultValue prefilles fra de indsendte værdier (state.values, ekkoet af
  // action'en) — brugerens indtastning må aldrig gå tabt ved en fejl.
  const v = state.values;
  // "Navn" holds the contact person for a company, or the display name otherwise.
  const navnDefault = v ? v.navn : (initial.isCompany ? initial.att : initial.name);

  return (
    <form action={formAction} className="card form-card">
      <div className="card-header header-primary">
        <h3>{title}</h3>
      </div>
      <div className="card-body">
        <div className="f2">
          <label>Kontakttype</label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 300, marginTop: 6 }}>
            <input type="checkbox" name="isCompany" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} /> Virksomhed
          </label>
        </div>

        {isCompany && (
          <>
            <div className="f2">
              <label>Virksomhedsnavn</label>
              <input name="companyName" defaultValue={v?.companyName ?? initial.companyName} className="form-control form-control-sm" />
            </div>
            <div className="f2">
              <label>CVR-nummer</label>
              <input name="cvr" defaultValue={v?.cvr ?? initial.cvr} className="form-control form-control-sm" />
            </div>
            <div className="f2">
              <label>EAN-nummer</label>
              <div>
                <input name="ean" defaultValue={v?.ean ?? initial.ean} className="form-control form-control-sm" />
                <small className="form-text field-help">Faktura sendes elektronisk via EAN, såfremt et EAN-nummer er angivet.</small>
              </div>
            </div>
          </>
        )}

        <div className="f2">
          <label>Navn</label>
          <input name="name" defaultValue={navnDefault} className="form-control form-control-sm" />
        </div>
        <div className="f2">
          <label>E-mail</label>
          <input name="email" defaultValue={v?.email ?? initial.email} className="form-control form-control-sm" type="email" />
        </div>
        <div className="f2">
          <label>Telefon</label>
          <input name="phone" defaultValue={v?.phone ?? initial.phone} className="form-control form-control-sm" />
        </div>
        <div className="f2">
          <label>Adresse</label>
          <AddressFinder name="address" initialValue={initial.address} />
        </div>
        <div className="f2">
          <label>Adressebemærkning</label>
          <div>
            <textarea name="note" defaultValue={v?.note ?? initial.note} className="form-control form-control-sm" />
            <small className="form-text field-help">Internt notat, der relaterer sig til adressen (kontakten).</small>
          </div>
        </div>

        {state.error && (
          <div className="f2">
            <span />
            <div style={{ color: "#c0392b", fontSize: 13 }}>{state.error}</div>
          </div>
        )}

        <div className="savebar">
          <Link href={cancelHref} className="btn btn-light">Luk</Link>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Gemmer…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
