// Top-navigation structure of the portal: seven menus, each a dropdown of routes.
// Mirrors the portal's information architecture (labels in Danish, English hints).
// This is an internal-use clone: no Karltoffel plan tiers, so nothing is gated
// bag betaling — men adminOnly-punkter skjules for ikke-admins (siderne bag dem
// afviser alligevel ikke-admins server-side; flaget fjerner kun blindgyden).
export type NavItem = { label: string; en: string; href: string; adminOnly?: boolean };
export type NavMenu = { label: string; en: string; items: NavItem[] };

/** Menuer som en given rolle må se: adminOnly-punkter filtreres fra for
 *  ikke-admins, og menuer uden punkter tilbage forsvinder helt. */
export function navForRole(isAdmin: boolean): NavMenu[] {
  if (isAdmin) return TOP_NAV;
  return TOP_NAV
    .map((m) => ({ ...m, items: m.items.filter((it) => !it.adminOnly) }))
    .filter((m) => m.items.length > 0);
}

export const TOP_NAV: NavMenu[] = [
  {
    label: "Kalender", en: "Calendar",
    items: [
      { label: "Kalender", en: "Calendar", href: "/calendar" },
    ],
  },
  { label: "Dagsprogram", en: "Day program", items: [{ label: "Dagsprogram", en: "Day program", href: "/daycalendar" }] },
  {
    label: "Indstillinger", en: "Settings",
    items: [
      { label: "Generelt", en: "General", href: "/settings", adminOnly: true },
      { label: "Udseende", en: "Appearance", href: "/funnel-settings", adminOnly: true },
      { label: "Brugere", en: "Users", href: "/users", adminOnly: true },
      { label: "Arbejdstider", en: "Working hours", href: "/working-hours", adminOnly: true },
      { label: "Planlægning", en: "Planning", href: "/planning-settings", adminOnly: true },
      { label: "Rabatkoder", en: "Discount codes", href: "/discount-codes", adminOnly: true },
      { label: "Gavekort", en: "Gift cards", href: "/giftcards", adminOnly: true },
      { label: "Standardopgaver", en: "Standard tasks", href: "/standard-tasks", adminOnly: true },
      { label: "Regnskab", en: "Accounting", href: "/accounting", adminOnly: true },
      { label: "E-mail og SMS skabeloner", en: "Templates", href: "/templates", adminOnly: true },
    ],
  },
  {
    label: "Funktioner", en: "Functions",
    items: [
      { label: "Timeregistrering", en: "Timesheet", href: "/timesheet", adminOnly: true },
      { label: "Gruppebeskeder", en: "Group messages", href: "/group-messages", adminOnly: true },
      { label: "Ferieplanlægning", en: "Holiday planning", href: "/holidays", adminOnly: true },
      { label: "Abonnementsoptimering", en: "Subscription optimization", href: "/optimization", adminOnly: true },
      { label: "Prisjustering", en: "Price adjustment", href: "/price-adjustments", adminOnly: true },
    ],
  },
  {
    label: "Kartotek", en: "Register",
    items: [
      { label: "Emner", en: "Leads", href: "/leads" },
      { label: "Kunder", en: "Customers", href: "/customers" },
      { label: "Abonnementer", en: "Subscriptions", href: "/subscriptions" },
      { label: "Fastprisaftaler", en: "Fixed-price agreements", href: "/fixed-prices" },
      { label: "Ordrer", en: "Orders", href: "/orders" },
    ],
  },
  {
    label: "Rapportering", en: "Reporting",
    items: [
      { label: "Grafer og nøgletal", en: "Charts & KPIs", href: "/reports/graphs", adminOnly: true },
      { label: "Lønrapport", en: "Payroll", href: "/payroll", adminOnly: true },
      { label: "Rapporter", en: "Reports", href: "/reports/download", adminOnly: true },
      { label: "Dagsprogram i PDF", en: "Day program PDF", href: "/reports/day-pdf" },
    ],
  },
  {
    label: "Fakturering", en: "Invoicing",
    items: [
      { label: "Faktureringsoverblik", en: "Invoicing overview", href: "/fakturering" },
      { label: "Omsætningsoverblik", en: "Revenue overview", href: "/omsaetningsoverblik", adminOnly: true },
    ],
  },
  {
    label: "Hjælp", en: "Help",
    items: [
      { label: "Vejledninger", en: "Guides", href: "/guides", adminOnly: true },
      { label: "Samarbejdspartnere", en: "Partners", href: "/partners", adminOnly: true },
      { label: "Karltoffel quiz", en: "Quiz", href: "/quiz", adminOnly: true },
      { label: "Kontakt support", en: "Support", href: "/support", adminOnly: true },
      { label: "AI Receptionist (prototype)", en: "AI Receptionist (prototype)", href: "/ai-receptionist", adminOnly: true },
    ],
  },
];

export const ACCOUNT_MENU: NavItem[] = [
  { label: "Karltoffel konto", en: "Account", href: "/account" },
  { label: "Skift password", en: "Change password", href: "/change-password" },
  { label: "Log ud", en: "Log out", href: "/logout" },
];

export const COMPANY_NAME = "KRLTFL ApS";
