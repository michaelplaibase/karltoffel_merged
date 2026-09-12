// Lead-kilder (Thomas, 2026-09-12): fælles kanal-liste — bruges af
// lead-beregneren (lib/lead-calc.ts), kunde-kartoteket og nu også Tilbud-
// modulets 'Lead-kilde'-boks. Egen fil (.mts, ingen DB-import), så klient-
// komponenter kan importere listen uden at trække prisma med i bundlen.
// Navnene er KANAL-navne i lead-beregneren — genbruges PRÆCIS, så tal i
// Business Manager → Leads aldrig afviger.
export const LEAD_SOURCES = ["SEO", "Meta", "Sociale medier", "Anbefaling", "Direkte", "Venteliste", "Andet"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
