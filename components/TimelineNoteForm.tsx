"use client";

// Note-formular til tidslinjen. Hænges på et emne (leadId) og/eller en kunde
// (contactId) via skjulte felter. Følger husets form-mønster (useActionState +
// .form-control/.btn). React 19 nulstiller selv det ukontrollerede felt efter
// en vellykket indsendelse.
import { useActionState } from "react";
import { addTimelineNote, type NoteState } from "@/app/actions/leads";

export default function TimelineNoteForm({ leadId, contactId }: { leadId?: number; contactId?: number }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(addTimelineNote, {});

  return (
    <form action={action} style={{ marginBottom: 16 }}>
      {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
      {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}
      <textarea
        name="body"
        className="form-control form-control-sm"
        rows={2}
        maxLength={4000}
        required
        defaultValue={state.body ?? ""}
        placeholder="Skriv en note … (fx referat af opkald, eller noget set på matriklen)"
      />
      {state.error ? (
        <div style={{ color: "var(--danger, #C4183C)", fontSize: 13, marginTop: 4 }}>{state.error}</div>
      ) : null}
      <div style={{ marginTop: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Gemmer…" : "Tilføj note"}
        </button>
      </div>
    </form>
  );
}
