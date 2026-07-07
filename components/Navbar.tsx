"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TOP_NAV, ACCOUNT_MENU, COMPANY_NAME } from "@/lib/nav";

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);      // desktop-dropdown
  const [mobileOpen, setMobileOpen] = useState(false);        // mobil-drawer
  const [expanded, setExpanded] = useState<string | null>(null); // åben accordion-gruppe i draweren
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  /* Rute-skift lukker alt (drawer inkl.) — justeret under render, som React
     anbefaler, i stedet for et kaskade-effect. ESC lukker draweren. */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setMobileOpen(false);
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* Scroll-lås mens draweren er åben (ellers scroller siden bagved på mobil). */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <nav className="navbar" ref={ref}>
      <Link href="/" className="navbar-brand">
        <span className="brand-logo">
          <i /><i /><i /><i />
        </span>
        Karltoffel
      </Link>

      {/* ---------- desktop: vandrette menuer ---------- */}
      <div className="nav-menus">
        {TOP_NAV.map((menu) => {
          const single = menu.items.length === 1 && menu.items[0].label === menu.label;
          if (single) {
            const it = menu.items[0];
            return (
              <div className="nav-item" key={menu.label}>
                <Link href={it.href} className={`nav-link ${isActive(it.href) ? "active" : ""}`}>
                  {menu.label}
                </Link>
              </div>
            );
          }
          const anyActive = menu.items.some((i) => isActive(i.href));
          return (
            <div className="nav-item" key={menu.label}>
              <button
                className={`nav-link ${anyActive ? "active" : ""}`}
                onClick={() => setOpen(open === menu.label ? null : menu.label)}
                aria-expanded={open === menu.label}
              >
                {menu.label}
                <i className="bi bi-caret-down-fill" />
              </button>
              {open === menu.label && (
                <div className="dropdown-menu">
                  {menu.items.map((it) => (
                    <Link key={it.href} href={it.href} className="dropdown-item">
                      <span>{it.label}</span>
                      <span className="en">{it.en}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="navbar-right nav-item">
        <button
          className="acct-toggle"
          onClick={() => setOpen(open === "__acct" ? null : "__acct")}
          aria-expanded={open === "__acct"}
        >
          <i className="bi bi-person-circle" />
          {COMPANY_NAME}
          <i className="bi bi-caret-down-fill" style={{ fontSize: 11 }} />
        </button>
        {open === "__acct" && (
          <div className="dropdown-menu right">
            {ACCOUNT_MENU.map((it) => (
              <Link key={it.href} href={it.href} className="dropdown-item">
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ---------- mobil: burger + fuldskærms-drawer ---------- */}
      <button
        className="nav-burger"
        aria-label={mobileOpen ? "Luk menu" : "Åbn menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <i className={`bi ${mobileOpen ? "bi-x-lg" : "bi-list"}`} />
      </button>

      {mobileOpen && (
        <div className="mobilenav" role="dialog" aria-label="Hovedmenu">
          {TOP_NAV.map((menu) => {
            const single = menu.items.length === 1 && menu.items[0].label === menu.label;
            if (single) {
              const it = menu.items[0];
              return (
                <Link key={menu.label} href={it.href}
                  className={`mn-link ${isActive(it.href) ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}>
                  {menu.label}
                </Link>
              );
            }
            const isExp = expanded === menu.label;
            const anyActive = menu.items.some((i) => isActive(i.href));
            return (
              <div key={menu.label} className="mn-group">
                <button
                  className={`mn-link ${anyActive ? "active" : ""}`}
                  aria-expanded={isExp}
                  onClick={() => setExpanded(isExp ? null : menu.label)}
                >
                  {menu.label}
                  <i className={`bi ${isExp ? "bi-chevron-up" : "bi-chevron-down"}`} />
                </button>
                {isExp && (
                  <div className="mn-sub">
                    {menu.items.map((it) => (
                      <Link key={it.href} href={it.href}
                        className={`mn-sublink ${isActive(it.href) ? "active" : ""}`}
                        onClick={() => setMobileOpen(false)}>
                        {it.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mn-acct">
            <div className="mn-acct-name"><i className="bi bi-person-circle" /> {COMPANY_NAME}</div>
            {ACCOUNT_MENU.map((it) => (
              <Link key={it.href} href={it.href} className="mn-sublink"
                onClick={() => setMobileOpen(false)}>{it.label}</Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
