"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EVENTS, WEEK_DAYS, EMPLOYEES, PLANNED, LEGEND, WEEK_LABEL, WEEK_NO,
  GRID_START, GRID_END, WORK_START, WORK_END, type CalEvent,
} from "@/lib/calendar";
import { categoryColor } from "@/lib/categories";

const HOUR = 75; // px per hour row
const bodyHeight = (GRID_END - GRID_START) * HOUR;
const hours = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
const fmt = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

export default function CalendarPage() {
  const [menu, setMenu] = useState<{ x: number; y: number; ev: CalEvent } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setMenu(null);
    if (menu) {
      document.addEventListener("click", close);
      return () => document.removeEventListener("click", close);
    }
  }, [menu]);

  function openMenu(e: React.MouseEvent, ev: CalEvent) {
    e.stopPropagation();
    setExpanded(null);
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 250), y: e.clientY, ev });
  }

  return (
    <div className="container-1140 cal-wrap">
      <div className="cal">
        {/* ---------- sidebar ---------- */}
        <aside className="cal-side">
          <div className="grp">Planlægning</div>
          <button className="genbtn">Genplanlæg uge</button>
          <div className="subhint">Planlagt i dag kl. 03:01</div>

          <div className="grp">Medarbejdere</div>
          {EMPLOYEES.map((e) => (
            <label className="chk" key={e.id}>
              <span className="box on" style={{ background: e.color, borderColor: e.color }} /> {e.name}
            </label>
          ))}

          <div className="grp">Planlagt omsætning</div>
          <div className="money-row"><span>{PLANNED.weekLabel}</span><b className="num">kr. {PLANNED.week.toLocaleString("da-DK")}</b></div>
          <div className="money-row"><span>{PLANNED.monthLabel}</span><b className="num">kr. {PLANNED.month.toLocaleString("da-DK")}</b></div>

          <div className="grp">Planlagt kørsel</div>
          <div className="money-row"><span>Man</span><b>{WEEK_DAYS[0].driving}</b></div>

          <div className="grp">Vis i kalender</div>
          <label className="chk"><span className="box on" /> Vis arbejdstider</label>
          <label className="chk"><span className="box on" /> Vis kørsel</label>

          <div className="legend2">
            <div className="grp">Forklaringer</div>
            {LEGEND.status.map((l) => (
              <div className="legend-row" key={l.label}>
                <span className="legend-sw" style={{ borderColor: l.color, background: l.fill }} /> {l.label}
              </div>
            ))}
            <div className="grp">Ordretype</div>
            <div className="legend-row muted">{LEGEND.type.join(" · ")}</div>
          </div>
        </aside>

        {/* ---------- main ---------- */}
        <div className="cal-main">
          <div className="cal-toolbar">
            <button className="calbtn">‹</button>
            <button className="calbtn">Idag</button>
            <button className="calbtn">›</button>
            <span className="title">{WEEK_LABEL}</span>
            <span className="badge badge-soft-muted">UGE {WEEK_NO}</span>
            <span className="spacer" />
            <div className="calseg">
              <button className="calbtn">Dag</button>
              <button className="calbtn">5 dg</button>
              <button className="calbtn on">7 dg</button>
            </div>
            <button className="calbtn"><i className="bi bi-search" /></button>
          </div>

          <div className="cal-grid">
            <div className="cal-corner" />
            {WEEK_DAYS.map((d) => (
              <div className="cal-dayhead" key={d.label}>
                <b>{d.label} {d.date}</b>
                <span className="kr">Kr. {d.revenue.toLocaleString("da-DK")}</span>
              </div>
            ))}

            <div className="cal-axis" style={{ height: bodyHeight }}>
              {hours.map((h) => (
                <div className="cal-hour" key={h} style={{ height: HOUR }}>{h}:00</div>
              ))}
            </div>

            {WEEK_DAYS.map((_, dayIdx) => (
              <div className="cal-daycol" key={dayIdx} style={{ height: bodyHeight }}>
                <div className="cal-nonbiz" style={{ top: 0, height: (WORK_START - GRID_START) * HOUR }} />
                <div className="cal-nonbiz" style={{ top: (WORK_END - GRID_START) * HOUR, height: (GRID_END - WORK_END) * HOUR }} />
                {EVENTS.filter((e) => e.day === dayIdx).map((ev) => (
                  <div
                    key={ev.id}
                    className={`cal-ev st-${ev.status}`}
                    style={{ top: (ev.start - GRID_START) * HOUR, height: (ev.end - ev.start) * HOUR }}
                    onClick={(e) => openMenu(e, ev)}
                  >
                    <span className="t">{fmt(ev.start)} – {fmt(ev.end)}</span>
                    <b>{ev.postal}</b>
                    <span>
                      <span className="catchip" style={{ background: categoryColor(ev.category), width: 15, height: 15, fontSize: 9 }}>A</span>{" "}
                      {ev.customer}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {menu && (
        <div className="ctxmenu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <Link href={`/orders/${menu.ev.id}`} className="ctxmenu-item">Rediger ordre …</Link>
          <div className="ctxmenu-item">Lås helt op</div>
          <div className="ctxmenu-item">Lås op, fastgør til ugedag</div>
          <div className="ctxmenu-sep" />
          <div className="ctxmenu-item" onClick={() => setExpanded(expanded === "flyt" ? null : "flyt")}>
            Flyt til anden uge … <i className="bi bi-caret-right-fill" />
          </div>
          {expanded === "flyt" && ["1 uge frem", "1 uge frem, lås helt op", "2 uger frem", "1 uge tilbage", "2 uger tilbage"].map((s) => (
            <div className="ctxmenu-item" key={s} style={{ paddingLeft: 34 }}>{s}</div>
          ))}
          <div className="ctxmenu-item" onClick={() => setExpanded(expanded === "mere" ? null : "mere")}>
            Mere … <i className="bi bi-caret-right-fill" />
          </div>
          {expanded === "mere" && ["Gå til kundedetaljer …", "Rediger abonnement …", "Send notifikation nu", "Afslut ordre …", "Slet ordre …"].map((s) => (
            <div className="ctxmenu-item" key={s} style={{ paddingLeft: 34 }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
