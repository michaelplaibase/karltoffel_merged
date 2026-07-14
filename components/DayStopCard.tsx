"use client";

// One stop in the day program. The tasks are always visible on the card; the
// icon row (fotos/bemærkninger/ordrehistorik/notifikation) expands inline
// detail panels; the action buttons navigate to the existing order/subscription
// flows, and "Mere ▾" opens a dropdown (vis i kalender / kundedetaljer / send
// notifikation / slet ordre).
import Link from "next/link";
import { useState, useTransition } from "react";
import { CatChip, money, telHref, telDisplay } from "@/components/ui";
import { deleteOrder } from "@/app/actions/orders";
import type { DayStop } from "@/lib/calendar";

export default function DayStopCard({ stop, weekMonday }: { stop: DayStop; weekMonday: string }) {
  const [panel, setPanel] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toggle = (k: string) => setPanel((p) => (p === k ? null : k));

  const tel = telHref(stop.phone);

  const icons: [string, string, string][] = [
    ["fotos", "bi-image", "fotos"],
    ["bemærkninger", "bi-info-circle", "bemærkninger"],
    ["ordrehistorik", "bi-card-checklist", "ordrehistorik"],
    ["notifikation", "bi-bell", "notifikation"],
  ];

  return (
    <div className="daycal-stop">
      <div style={{ minWidth: 0 }}>
        <div className="when">{stop.from} - {stop.to}</div>
        <a className="maplink" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`} target="_blank" rel="noopener noreferrer">
          <i className="bi bi-geo-alt-fill" /> {stop.address}
        </a>
        {tel ? (
          <a className="maplink" href={tel} style={{ marginLeft: 12 }}>
            <i className="bi bi-telephone-fill" /> {telDisplay(stop.phone)}
          </a>
        ) : (
          <span className="maplink" style={{ marginLeft: 12, color: "var(--muted)", opacity: 0.55 }} title="Intet telefonnummer">
            <i className="bi bi-telephone-fill" /> Intet telefonnummer
          </span>
        )}
        <div style={{ fontWeight: 600, marginTop: 2 }}>{stop.customer} · <span className="num">{money(stop.price)}</span></div>
        {stop.tasks.length > 0 && (
          <div className="daycal-tasks">
            {stop.tasks.map((t, i) => (
              <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description} · <span className="num">{t.durationMin} min</span></div>
            ))}
          </div>
        )}
        <div className="daycal-icons">
          {icons.map(([key, icon, label]) => (
            <span key={key} role="button" tabIndex={0} style={{ cursor: "pointer", color: panel === key ? "var(--primary)" : undefined }} onClick={() => toggle(key)}>
              <i className={`bi ${icon}`} /> {label}
            </span>
          ))}
        </div>

        {panel && (
          <div className="help-note" style={{ marginTop: 8, fontSize: 12.5 }}>
            {panel === "fotos" && "Ingen fotos på ordren."}
            {panel === "bemærkninger" && (stop.comment || stop.addressNote
              ? <>{stop.comment && <div>Ordrekommentar: {stop.comment}</div>}{stop.addressNote && <div>Adressebemærkning: {stop.addressNote}</div>}</>
              : "Ingen bemærkninger")}
            {panel === "ordrehistorik" && <>Ordre #{stop.orderId} · Kilde: {stop.source} · Status: {stop.status}</>}
            {panel === "notifikation" && "Notifikationer styres via skabelonerne i Indstillinger → E-mail og SMS."}
          </div>
        )}
      </div>

      <div className="row-actions" style={{ position: "relative" }}>
        <Link href={`/orders/${stop.orderId}/complete`} className="btn btn-outline-primary btn-sm">Afslut ordre</Link>
        <Link href={`/orders/${stop.orderId}`} className="btn btn-outline-primary btn-sm">Rediger ordre</Link>
        {stop.subscriptionNo != null
          ? <Link href={`/subscriptions/${stop.subscriptionNo}`} className="btn btn-outline-primary btn-sm">Rediger abo.</Link>
          : <button className="btn btn-outline-primary btn-sm" disabled title="Ordren stammer ikke fra et abonnement">Rediger abo.</button>}
        <button className="btn btn-outline-primary btn-sm" onClick={() => setMore((v) => !v)}>Mere ▾</button>

        {more && (
          <div className="dropdown-menu" style={{ display: "block", right: 0, left: "auto", top: "calc(100% + 2px)" }} onMouseLeave={() => setMore(false)}>
            <Link href={`/calendar?week=${weekMonday}`} className="dropdown-item" onClick={() => setMore(false)}><span>Vis i kalender</span></Link>
            <Link href={`/customers/${stop.contactId}`} className="dropdown-item" onClick={() => setMore(false)}><span>Gå til kundedetaljer</span></Link>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer" }}
              onClick={() => { setMore(false); setNotice(`Notifikation sendt til ${stop.customer} (simuleret).`); }}><span>Send notifikation nu</span></button>
            <button type="button" className="dropdown-item" style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: "var(--danger, #C4183C)" }}
              onClick={() => { setMore(false); setConfirm(true); }}><span>Slet ordre …</span></button>
          </div>
        )}
      </div>

      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }} onClick={() => !pending && setConfirm(false)}>
          <div style={{ background: "#fff", borderRadius: 6, padding: "20px 22px", width: 440, maxWidth: "92vw", boxShadow: "0 10px 40px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 12px" }}>Slet ordre</h4>
            <p style={{ margin: 0 }}>Er du sikker på, at du vil slette ordre #{stop.orderId}?</p>
            <p style={{ color: "#c0392b", fontSize: 13, margin: "8px 0 0" }}>Denne handling kan ikke fortrydes.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-light" disabled={pending} onClick={() => setConfirm(false)}>Luk</button>
              <button type="button" className="btn btn-danger" disabled={pending}
                onClick={() => startTransition(async () => { await deleteOrder(stop.orderId, null); setConfirm(false); })}>{pending ? "Vent…" : "Slet ordre"}</button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div onClick={() => setNotice(null)} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#212529", color: "#fff", padding: "10px 18px", borderRadius: 6, fontSize: 14, zIndex: 4000, boxShadow: "0 6px 24px rgba(0,0,0,.3)", cursor: "pointer" }}>{notice}</div>
      )}
    </div>
  );
}
