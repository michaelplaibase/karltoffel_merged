"use client";

// Reusable customer picker. A v1 select over existing contacts (the live portal
// uses a search-or-create textarea widget — a later enhancement). Shows the
// picked contact's address summary and a link to create a new contact.
import { useState } from "react";

export type ContactOption = { id: number; name: string; address: string };

export default function ContactPicker({
  contacts, initialId, name = "contactId",
}: {
  contacts: ContactOption[];
  initialId?: number;
  name?: string;
}) {
  const [id, setId] = useState<string>(initialId ? String(initialId) : "");
  const selected = contacts.find((c) => String(c.id) === id);

  return (
    <div>
      <select name={name} value={id} onChange={(e) => setId(e.target.value)} className="form-control form-control-sm">
        <option value="">Vælg kontakt…</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>{c.name} — {c.address}</option>
        ))}
      </select>
      {selected && (
        <div className="form-static" style={{ marginTop: 8 }}>
          <b>{selected.name}</b>{"\n"}{selected.address}
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        {/* Ny fane: pickeren står midt i en større formular (ordre/abonnement/
            fastpris), og en navigation i samme fane ville kassere alt det
            indtastede uden varsel. */}
        <a href="/customers/new" target="_blank" rel="noopener" className="btn btn-light btn-sm">Opret ny kontakt (ny fane)</a>
      </div>
    </div>
  );
}
