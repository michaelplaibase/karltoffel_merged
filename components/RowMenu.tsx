"use client";

// Reusable row-action dropdown for every list/table (Kartotek, customer detail).
// Replaces the old decorative RowCaret (a three-dots icon with only a tooltip).
// Renders the identical caret button, and on click opens a real menu whose items
// either navigate (Link) or fire a bound server action behind a confirm modal
// (the Bootstrap-style two-step delete pattern, matching ConfirmButton).
//
// The menu is rendered with position:fixed anchored to the caret's rect so it is
// never clipped by the table's `overflow-x:auto` wrapper.
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

export type RowMenuItem = {
  label: string;
  href?: string;                 // navigation item
  danger?: boolean;              // red styling (destructive)
  action?: () => Promise<void>;  // bound server action (fired after confirm)
  confirm?: { title: string; body: string; confirmLabel: string; note?: string };
};

const backdrop: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000,
};
const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 6, padding: "20px 22px", width: 440, maxWidth: "92vw",
  boxShadow: "0 10px 40px rgba(0,0,0,.25)",
};

export default function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [confirm, setConfirm] = useState<RowMenuItem | null>(null);
  const [pending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current!.getBoundingClientRect();
    setPos({ x: Math.min(r.left, window.innerWidth - 240), y: r.bottom + 2 });
    setOpen(true);
  }

  return (
    <>
      <button ref={btnRef} type="button" className="rowcaret" aria-label="Handlinger"
        style={{ background: "#fff", cursor: "pointer" }} onClick={toggle}>
        <i className="bi bi-three-dots-vertical" />
      </button>

      {open && pos && (
        <div className="dropdown-menu" style={{ display: "block", position: "fixed", left: pos.x, top: pos.y }}
          onClick={(e) => e.stopPropagation()}>
          {items.map((it) =>
            it.href ? (
              <Link key={it.label} href={it.href} className="dropdown-item" onClick={() => setOpen(false)}>
                <span>{it.label}</span>
              </Link>
            ) : (
              <button key={it.label} type="button" className="dropdown-item"
                style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: it.danger ? "var(--danger, #C4183C)" : undefined }}
                onClick={() => { setOpen(false); if (it.confirm) setConfirm(it); else it.action?.(); }}>
                <span>{it.label}</span>
              </button>
            )
          )}
        </div>
      )}

      {confirm && (
        <div style={backdrop} onClick={() => !pending && setConfirm(null)}>
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 12px" }}>{confirm.confirm!.title}</h4>
            <p style={{ margin: 0 }}>{confirm.confirm!.body}</p>
            {confirm.confirm!.note && <p style={{ color: "#c0392b", fontSize: 13, margin: "8px 0 0" }}>{confirm.confirm!.note}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-light" disabled={pending} onClick={() => setConfirm(null)}>Luk</button>
              <button type="button" className="btn btn-danger" disabled={pending}
                onClick={() => startTransition(async () => { await confirm.action!(); setConfirm(null); })}>
                {pending ? "Vent…" : confirm.confirm!.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
