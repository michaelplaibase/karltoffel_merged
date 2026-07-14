"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { CalendarMonth, CalendarWeek, CalStatus } from "@/lib/calendar";
import { categoryColor } from "@/lib/categories";
import { telHref, telDisplay } from "@/components/ui";
import { setOrderLock, moveOrderWeeks, replanWeek, deleteOrder } from "@/app/actions/orders";

type Props =
  | { mode: "week"; week: CalendarWeek; nav: { prevWeek: string; nextWeek: string; monthParam: string } }
  | { mode: "month"; month: CalendarMonth; nav: { prevWeek?: never } };

/** What the context menu needs to act on an order — both board events and unplanned jobs qualify. */
type MenuTarget = { id: number; contactId: number; subscriptionNo: number | null; phone: string | null };

const STATUS_CLASS: Record<CalStatus, string> = {
  afsluttet: "s-ok",
  afventer: "s-wait",
  ikke_afsluttet: "s-warn",
  mislykket: "s-fail",
};

// Status colours use the app's global design tokens (the .s-* card borders map
// to these same values via --tc-*), so legend swatches match the cards exactly.
const STATUS_LEGEND: [string, string][] = [
  ["var(--success)", "Afsluttet"], ["var(--primary)", "Afventer"],
  ["var(--warning)", "Ikke afsluttet"], ["var(--danger)", "Mislykket"],
];

const DAY_HEADS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/** Decimal hours → "HH:MM" (8.5 → "08:30"). */
function fmtHM(h: number): string {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "Bjarne Schmidt Hansen" → "BH" (first + last word). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** ISO date `n` days after a Monday-date string (UTC-stable). */
function isoAddDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const kr = (n: number) => `kr. ${n.toLocaleString("da-DK")}`;

// Today's local ISO date — null during SSR so server and client markup agree.
const noopSubscribe = () => () => {};
const localTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const empVar = (color: string) => ({ "--emp": color } as React.CSSProperties);
const catLetter = (category: string) => (category.charAt(0) || "?").toUpperCase();

export default function TeamCalendarClient(props: Props) {
  const employees = props.mode === "week" ? props.week.employees : props.month.employees;
  const empById = new Map(employees.map((e) => [e.id, e]));

  const [menu, setMenu] = useState<{ x: number; y: number; ev: MenuTarget } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // View state (all client-side, no reload):
  const [selectedEmp, setSelectedEmp] = useState<Set<number>>(() => new Set(employees.map((e) => e.id)));
  const [usersOpen, setUsersOpen] = useState(false);
  const [monthView, setMonthView] = useState<"dato" | "oversigt">("dato"); // month sub-toggle [Dato | Oversigt]
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<MenuTarget | null>(null);
  const todayISO = useSyncExternalStore(noopSubscribe, localTodayISO, () => null); // null during SSR → no hydration drift
  const menuRef = useRef<HTMLDivElement>(null);
  const usersRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!menu) return;
    // Close only on clicks OUTSIDE the menu — clicks inside (submenu toggles) keep
    // it open. (React's stopPropagation can't block this sibling document listener.)
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null); setExpanded(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  useEffect(() => {
    if (!usersOpen) return;
    const close = (e: MouseEvent) => {
      if (usersRef.current?.contains(e.target as Node)) return;
      setUsersOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [usersOpen]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  function openMenu(e: React.MouseEvent, ev: MenuTarget) {
    e.stopPropagation();
    setExpanded(null);
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 250), y: e.clientY, ev });
  }

  function run(fn: () => Promise<void>) {
    setMenu(null);
    startTransition(async () => { await fn(); });
  }

  function toggleEmp(id: number) {
    setSelectedEmp((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const shown = employees.filter((e) => selectedEmp.has(e.id));
  const menuTel = menu ? telHref(menu.ev.phone) : null; // null when the number is missing/undialable

  // ---------- toolbar ----------
  const toolbar = (
    <div className="panel-hd">
      <div className="navlead">
        {props.mode === "week" ? (
          <>
            <Link className="cbtn" href={`/calendar?week=${props.nav.prevWeek}`}>‹</Link>
            <Link className="cbtn" href="/calendar">I dag</Link>
            <Link className="cbtn" href={`/calendar?week=${props.nav.nextWeek}`}>›</Link>
          </>
        ) : (
          <>
            <Link className="cbtn" href={`/calendar?view=month&month=${props.month.prevMonth}`}>‹</Link>
            <Link className="cbtn" href="/calendar?view=month">I dag</Link>
            <Link className="cbtn" href={`/calendar?view=month&month=${props.month.nextMonth}`}>›</Link>
          </>
        )}
      </div>
      <span className="title">{props.mode === "week" ? props.week.weekLabel : props.month.monthLabel}</span>
      <span className="badge acc num">
        {props.mode === "week"
          ? `UGE ${props.week.weekNo}`
          : `UGE ${props.month.weekNos[0]}–${props.month.weekNos[props.month.weekNos.length - 1]}`}
      </span>
      <span className="sp" />
      {props.mode === "week" && (
        <button className="cbtn" type="button" disabled={pending} onClick={() => run(() => replanWeek(props.week.monday))}>
          {pending ? "Planlægger…" : "Genplanlæg uge"}
        </button>
      )}
      {props.mode === "month" && (
        <div className="seg" title="Dato-gitter eller kollega × uge-oversigt">
          <button className={`cbtn${monthView === "dato" ? " on" : ""}`} type="button" onClick={() => setMonthView("dato")}>Dato</button>
          <button className={`cbtn${monthView === "oversigt" ? " on" : ""}`} type="button" onClick={() => setMonthView("oversigt")}>Oversigt</button>
        </div>
      )}
      <div className="seg" title="Uge er standard — skift til måned">
        <Link className={`cbtn${props.mode === "week" ? " on" : ""}`}
          href={props.mode === "week" ? `/calendar?week=${props.week.monday}` : "/calendar"}>Uge</Link>
        <Link className={`cbtn${props.mode === "month" ? " on" : ""}`}
          href={`/calendar?view=month&month=${props.mode === "week" ? props.nav.monthParam : props.month.monthParam}`}>Måned</Link>
      </div>
      <span ref={usersRef} style={{ position: "relative" }}>
        <button className={`cbtn${usersOpen ? " on" : ""}`} type="button" title="Vælg hvilke kollegaer der vises"
          onClick={() => setUsersOpen((v) => !v)}>Brugere · {shown.length}</button>
        {usersOpen && (
          <div className="ctxmenu" style={{ position: "absolute", left: "auto", right: 0, top: "calc(100% + 6px)", zIndex: 60 }}>
            {employees.map((e) => {
              const on = selectedEmp.has(e.id);
              return (
                <div className="ctxmenu-item" key={e.id} style={{ whiteSpace: "nowrap", opacity: on ? 1 : 0.45 }}
                  onClick={() => toggleEmp(e.id)}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: e.color, marginRight: 8 }} />
                  {e.name}{on ? " ✓" : ""}
                </div>
              );
            })}
          </div>
        )}
      </span>
    </div>
  );

  // ---------- week board ----------
  function weekBoard(week: CalendarWeek) {
    return (
      <div className="board-scroll">
        <div className="board">
          <div className="corner">Medarbejder</div>
          {week.days.map((d, i) => (
            <div key={i} className={`dhead${i >= 5 ? " wknd" : ""}${isoAddDays(week.monday, i) === todayISO ? " today" : ""}`}>
              <b><Link href={`/daycalendar?date=${isoAddDays(week.monday, i)}`} style={{ color: "inherit" }}>{d.label} {d.date}</Link></b>
              <span className="kr num">{d.revenue > 0 ? kr(d.revenue) : "—"}</span>
            </div>
          ))}

          {shown.map((emp) => {
            const empEvents = week.events.filter((e) => e.employeeId === emp.id);
            return (
              <Fragment key={emp.id}>
                <div className="lbl" style={empVar(emp.color)}>
                  <span className="ava">{initials(emp.name)}</span>
                  <span className="who">
                    <b>{emp.name}</b>
                    <span className="num">{empEvents.length} {empEvents.length === 1 ? "opgave" : "opgaver"}</span>
                  </span>
                </div>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const evs = empEvents.filter((e) => e.day === day).sort((a, b) => a.start - b.start);
                  return (
                    <div key={day} style={empVar(emp.color)}
                      className={`cell${day >= 5 ? " wknd" : ""}${isoAddDays(week.monday, day) === todayISO ? " today" : ""}`}>
                      {evs.length > 0 ? (
                        <div className="stack">
                          {evs.map((ev) => (
                            <div key={ev.id} className={`ev ${STATUS_CLASS[ev.status]}`} style={{ cursor: "pointer" }}
                              onClick={(e) => openMenu(e, ev)}>
                              <span className="t num">{fmtHM(ev.start)}–{fmtHM(ev.end)}</span>
                              <span className="h">{ev.postal}</span>
                              <span className="s">
                                <i className="cat" style={{ "--cat": categoryColor(ev.category) } as React.CSSProperties}>{catLetter(ev.category)}</i>
                                <span className="txt">{ev.customer}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : empEvents.length === 0 && day < 5 ? (
                        <span className="idle">Ledig</span>
                      ) : null}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>

        {week.unplanned.length > 0 && (
          <div className="lane">
            <div className="lbl">
              <span className="ava" style={empVar("var(--danger)")}>!</span>
              <span className="who"><b>Ikke planlagt</b><span>Mangler medarbejder / plads</span></span>
            </div>
            <div className="bin">
              {week.unplanned.map((job) => (
                <div key={job.id} className={`ev ${STATUS_CLASS[job.status]}`}
                  style={{ ...empVar("var(--muted)"), width: 200, cursor: "pointer" }}
                  onClick={(e) => openMenu(e, job)}>
                  <span className="t num">Uge {week.weekNo}</span>
                  <span className="h">{job.postal}</span>
                  <span className="s">
                    <i className="cat" style={{ "--cat": categoryColor(job.category) } as React.CSSProperties}>{catLetter(job.category)}</i>
                    <span className="txt">{job.customer} · {job.reason === "unassigned" ? "Ikke tildelt kollega" : job.reason === "holiday" ? "Ferielukket uge — skal flyttes" : "Ingen plads i ugen"}</span>
                  </span>
                </div>
              ))}
              <span className="hint">Ordrer uden kollega eller uden plads i ugen.</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- month variant A: date grid ----------
  function monthGrid(month: CalendarMonth) {
    return (
      <div className="mgrid">
        <div className="mh" />
        {DAY_HEADS.map((l) => <div className="mh" key={l}>{l}</div>)}
        {month.weeks.map((w) => (
          <Fragment key={w.monday}>
            <div className="wk num">{w.weekNo}</div>
            {w.holiday ? (
              <div className="ferie">Ferielukket · uge {w.weekNo}</div>
            ) : (
              w.days.map((d) => {
                const chips = d.chips.filter((c) => selectedEmp.has(c.employeeId));
                return (
                  <div key={d.dateISO}
                    className={`md${d.inMonth ? "" : " out"}${d.isToday ? " today" : ""}${d.weekday >= 5 ? " wknd" : ""}`}>
                    <span className="dn num">{d.dateNum}</span>
                    {chips.slice(0, 3).map((c) => (
                      <span key={c.id} className="chip" style={empVar(empById.get(c.employeeId)?.color ?? "var(--muted)")}>{c.label}</span>
                    ))}
                    {chips.length > 3 && <span className="more">+{chips.length - 3} mere</span>}
                  </div>
                );
              })
            )}
          </Fragment>
        ))}
      </div>
    );
  }

  // ---------- month variant B: employee × week ----------
  function monthTable(month: CalendarMonth) {
    const holidayCol = month.weekNos.map((no) => month.weeks.find((w) => w.weekNo === no)?.holiday ?? false);
    return (
      <div style={{ overflowX: "auto" }}>
        <table className="mtable">
          <thead>
            <tr>
              <th className="emp">Kollega</th>
              {month.weekNos.map((no) => <th key={no} className="num">Uge {no}</th>)}
              <th>I alt</th>
            </tr>
          </thead>
          <tbody>
            {month.matrix.filter((r) => selectedEmp.has(r.employeeId)).map((row) => {
              const emp = empById.get(row.employeeId);
              return (
                <tr key={row.employeeId} style={empVar(emp?.color ?? "var(--muted)")}>
                  <td className="emp">
                    <span className="mini"><span className="empc">{initials(emp?.name ?? "?")}</span> {emp?.name ?? `#${row.employeeId}`}</span>
                  </td>
                  {row.cells.map((c, k) => holidayCol[k] ? (
                    <td key={k} className="ferie-col">ferie</td>
                  ) : (
                    <td key={k}><span className="cnt" style={c.count === 0 ? { color: "var(--faint)" } : undefined}>{c.count}</span></td>
                  ))}
                  <td><span className="cnt">{row.total.count}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="emp">I alt</td>
              {month.colTotals.map((c, k) => holidayCol[k] ? (
                <td key={k} className="ferie-col">—</td>
              ) : (
                <td key={k} className="num">{c.count}</td>
              ))}
              <td className="num">{month.grandTotal.count}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="teamcal">
      <div className="stage">
        <div className="app">
          {toolbar}

          {props.mode === "week"
            ? weekBoard(props.week)
            : monthView === "dato" ? monthGrid(props.month) : monthTable(props.month)}

          <div className="legend">
            {props.mode === "week" && (
              <div className="grp"><span className="k">Status</span>
                {STATUS_LEGEND.map(([c, label]) => (
                  <span className="lg" key={label}><span className="sw" style={{ "--c": c } as React.CSSProperties} />{label}</span>
                ))}
              </div>
            )}
            <div className="grp"><span className="k">Kollega</span>
              {employees.map((e) => (
                <span className="lg" key={e.id}><span className="dot" style={{ "--c": e.color } as React.CSSProperties} />{e.name}</span>
              ))}
            </div>
            {props.mode === "month" && (
              <div className="grp"><span className="k">Bemærk</span>
                <span className="lg" style={{ color: "var(--muted)" }}>Ugedagen for ikke-låste ordrer kan flytte sig ved genplanlægning — kun ugen er fast.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {menu && (
        <div className="ctxmenu" ref={menuRef} style={{ left: menu.x, top: menu.y }}>
          <Link href={`/orders/${menu.ev.id}`} className="ctxmenu-item">Rediger ordre …</Link>
          <div className="ctxmenu-item" onClick={() => run(() => setOrderLock(menu.ev.id, false))}>Lås helt op</div>
          <div className="ctxmenu-item" onClick={() => run(() => setOrderLock(menu.ev.id, true))}>Lås op, fastgør til ugedag</div>
          <div className="ctxmenu-sep" />
          <div className="ctxmenu-item" onClick={() => setExpanded(expanded === "flyt" ? null : "flyt")}>
            Flyt til anden uge … <i className="bi bi-caret-right-fill" />
          </div>
          {expanded === "flyt" && ([
            ["1 uge frem", 1, false], ["1 uge frem, lås helt op", 1, true],
            ["2 uger frem", 2, false], ["1 uge tilbage", -1, false], ["2 uger tilbage", -2, false],
          ] as [string, number, boolean][]).map(([label, w, unlock]) => (
            <div className="ctxmenu-item" key={label} style={{ paddingLeft: 34 }}
              onClick={() => run(() => moveOrderWeeks(menu.ev.id, w, unlock))}>{label}</div>
          ))}
          <div className="ctxmenu-item" onClick={() => setExpanded(expanded === "mere" ? null : "mere")}>
            Mere … <i className="bi bi-caret-right-fill" />
          </div>
          {expanded === "mere" && (
            <>
              <Link href={`/customers/${menu.ev.contactId}`} className="ctxmenu-item" style={{ paddingLeft: 34 }}>Gå til kundedetaljer …</Link>
              {menuTel != null ? (
                <a href={menuTel} className="ctxmenu-item" style={{ paddingLeft: 34 }}>Ring kunden op · {telDisplay(menu.ev.phone)}</a>
              ) : (
                <div className="ctxmenu-item" style={{ paddingLeft: 34, color: "var(--muted)", opacity: 0.55, cursor: "default" }} title="Intet telefonnummer">Intet telefonnummer</div>
              )}
              {menu.ev.subscriptionNo != null && (
                <Link href={`/subscriptions/${menu.ev.subscriptionNo}`} className="ctxmenu-item" style={{ paddingLeft: 34 }}>Rediger abonnement …</Link>
              )}
              <div className="ctxmenu-item" style={{ paddingLeft: 34 }}
                onClick={() => { setNotice(`Notifikation sendt til kunden for ordre #${menu.ev.id} (simuleret).`); setMenu(null); }}>Send notifikation nu</div>
              <Link href={`/orders/${menu.ev.id}/complete`} className="ctxmenu-item" style={{ paddingLeft: 34 }}>Afslut ordre …</Link>
              <div className="ctxmenu-item" style={{ paddingLeft: 34, color: "var(--danger, #C4183C)" }}
                onClick={() => { setConfirmDel(menu.ev); setMenu(null); }}>Slet ordre …</div>
            </>
          )}
        </div>
      )}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}
          onClick={() => !pending && setConfirmDel(null)}>
          <div style={{ background: "#fff", borderRadius: 6, padding: "20px 22px", width: 440, maxWidth: "92vw", boxShadow: "0 10px 40px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 12px" }}>Slet ordre</h4>
            <p style={{ margin: 0 }}>Er du sikker på, at du vil slette ordre #{confirmDel.id}?</p>
            <p style={{ color: "#c0392b", fontSize: 13, margin: "8px 0 0" }}>Denne handling kan ikke fortrydes.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-light" disabled={pending} onClick={() => setConfirmDel(null)}>Luk</button>
              <button type="button" className="btn btn-danger" disabled={pending}
                onClick={() => { const id = confirmDel.id; startTransition(async () => { await deleteOrder(id, null); }); setConfirmDel(null); }}>
                {pending ? "Vent…" : "Slet ordre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div onClick={() => setNotice(null)}
          style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#212529", color: "#fff", padding: "10px 18px", borderRadius: 6, fontSize: 14, zIndex: 4000, boxShadow: "0 6px 24px rgba(0,0,0,.3)", cursor: "pointer" }}>
          {notice}
        </div>
      )}
    </div>
  );
}
