"use client";

// Business Manager-faner med aktiv-markering (kræver pathname → klientkomponent).
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/business-manager", label: "Dashboard", exact: true },
  { href: "/business-manager/medarbejdere", label: "Omsætning & medarbejdere" },
  { href: "/business-manager/biler", label: "Biler" },
  { href: "/business-manager/maskiner", label: "Maskiner" },
  { href: "/business-manager/leads", label: "Lead-beregner" },
];

export default function BusinessManagerTabs() {
  const pathname = usePathname();
  return (
    <div className="bm-tabs" role="tablist">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`bm-tab ${active ? "bm-tab-active" : ""}`} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
