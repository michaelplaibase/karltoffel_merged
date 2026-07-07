// Top-navigation structure of the portal: seven menus, each a dropdown of routes.
// Mirrors the portal's information architecture (labels in Danish, English hints).
// This is an internal-use clone: no Fenster plan tiers, so nothing is gated.
export type NavItem = { label: string; en: string; href: string };
export type NavMenu = { label: string; en: string; items: NavItem[] };

export const TOP_NAV: NavMenu[] = [
  { label: "Kalender", en: "Calendar", items: [{ label: "Kalender", en: "Calendar", href: "/calendar" }] },
  { label: "Dagsprogram", en: "Day program", items: [{ label: "Dagsprogram", en: "Day program", href: "/daycalendar" }] },
  {
    label: "Indstillinger", en: "Settings",
    items: [
      { label: "Generelt", en: "General", href: "/settings" },
      { label: "Udseende", en: "Appearance", href: "/funnel-settings" },
      { label: "Brugere", en: "Users", href: "/users" },
      { label: "Arbejdstider", en: "Working hours", href: "/working-hours" },
      { label: "Planlægning", en: "Planning", href: "/planning-settings" },
      { label: "Rabatkoder", en: "Discount codes", href: "/discount-codes" },
      { label: "Standardopgaver", en: "Standard tasks", href: "/standard-tasks" },
      { label: "Regnskab", en: "Accounting", href: "/accounting" },
      { label: "E-mail og SMS skabeloner", en: "Templates", href: "/templates" },
    ],
  },
  {
    label: "Funktioner", en: "Functions",
    items: [
      { label: "Gruppebeskeder", en: "Group messages", href: "/group-messages" },
      { label: "Ferieplanlægning", en: "Holiday planning", href: "/holidays" },
      { label: "Abonnementsoptimering", en: "Subscription optimization", href: "/optimization" },
      { label: "Prisjustering", en: "Price adjustment", href: "/price-adjustments" },
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
      { label: "Grafer og nøgletal", en: "Charts & KPIs", href: "/reports/graphs" },
      { label: "Rapporter", en: "Reports", href: "/reports/download" },
      { label: "Dagsprogram i PDF", en: "Day program PDF", href: "/reports/day-pdf" },
    ],
  },
  {
    label: "Hjælp", en: "Help",
    items: [
      { label: "Vejledninger", en: "Guides", href: "/guides" },
      { label: "Samarbejdspartnere", en: "Partners", href: "/partners" },
      { label: "Karltoffel quiz", en: "Quiz", href: "/quiz" },
      { label: "Kontakt support", en: "Support", href: "/support" },
    ],
  },
];

export const ACCOUNT_MENU: NavItem[] = [
  { label: "Karltoffel konto", en: "Account", href: "/account" },
  { label: "Skift password", en: "Change password", href: "/change-password" },
  { label: "Log ud", en: "Log out", href: "/logout" },
];

export const COMPANY_NAME = "KRLTFL ApS";
