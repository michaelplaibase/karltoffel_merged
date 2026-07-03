"use client";

// Two-step destructive action: a danger button that opens a Bootstrap-style
// confirm modal (grey Luk + red action). On confirm it invokes the bound server
// action (which mutates + redirects). Modal styling is inlined since the app has
// no modal CSS.
import { useState, useTransition } from "react";

const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const card: React.CSSProperties = {
  background: "#fff", borderRadius: 6, padding: "20px 22px", width: 440, maxWidth: "92vw",
  boxShadow: "0 10px 40px rgba(0,0,0,.25)",
};

export default function ConfirmButton({
  action, label, title, body, confirmLabel, irreversibleNote,
}: {
  action: () => Promise<void> | void;
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  irreversibleNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div style={backdrop} onClick={() => !pending && setOpen(false)}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 12px" }}>{title}</h4>
            <p style={{ margin: 0 }}>{body}</p>
            {irreversibleNote && <p style={{ color: "#c0392b", fontSize: 13, margin: "8px 0 0" }}>{irreversibleNote}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-light" disabled={pending} onClick={() => setOpen(false)}>Luk</button>
              <button type="button" className="btn btn-danger" disabled={pending}
                onClick={() => startTransition(async () => { await action(); })}>
                {pending ? "Vent…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
