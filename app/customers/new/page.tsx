"use client";

import Link from "next/link";
import { useState } from "react";

export default function NewContact() {
  const [isCompany, setIsCompany] = useState(false);

  return (
    <div className="card form-card">
      <div className="card-header header-primary">
        <h3>Opret ny kontakt</h3>
      </div>
      <div className="card-body">
        <div className="f2">
          <label>Kontakttype</label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 300, marginTop: 6 }}>
            <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} /> Virksomhed
          </label>
        </div>

        {isCompany && (
          <>
            <div className="f2">
              <label>Virksomhedsnavn</label>
              <input className="form-control form-control-sm" />
            </div>
            <div className="f2">
              <label>CVR-nummer</label>
              <input className="form-control form-control-sm" />
            </div>
            <div className="f2">
              <label>EAN-nummer</label>
              <div>
                <input className="form-control form-control-sm" />
                <small className="form-text field-help">Faktura sendes elektronisk via EAN, såfremt et EAN-nummer er angivet.</small>
              </div>
            </div>
          </>
        )}

        <div className="f2">
          <label>Navn</label>
          <input className="form-control form-control-sm" />
        </div>
        <div className="f2">
          <label>E-mail</label>
          <input className="form-control form-control-sm" type="email" />
        </div>
        <div className="f2">
          <label>Telefon</label>
          <input className="form-control form-control-sm" />
        </div>
        <div className="f2">
          <label>Adresse</label>
          <input className="form-control form-control-sm" placeholder="Vejnavn husnr., postnr. by" />
        </div>
        <div className="f2">
          <label>Adressebemærkning</label>
          <div>
            <textarea className="form-control form-control-sm" />
            <small className="form-text field-help">Internt notat, der relaterer sig til adressen (kontakten).</small>
          </div>
        </div>

        <div className="savebar">
          <Link href="/customers" className="btn btn-light">Luk</Link>
          <button className="btn btn-primary" type="button">Opret kontakt</button>
        </div>
      </div>
    </div>
  );
}
