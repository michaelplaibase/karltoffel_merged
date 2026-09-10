// The 15 Karltoffel task categories. Each drives the colored letter-chip shown on
// every task line across orders, subscriptions and fixed-price agreements.
// Hex values are the exact ones observed in the live portal.
export const CATEGORIES: Record<string, string> = {
  Vinduespudsning: "#257BB6",
  Rentvandsvask: "#469990",
  Tagrenderens: "#911eb4",
  Overfladerens: "#e5c700",
  Algebehandling: "#f58231",
  Overfladebeskyttelse: "#e6194B",
  Privatrengøring: "#3cb44b",
  Ejendomsrengøring: "#f032e6",
  Viceværtservice: "#000075",
  "Grøn service": "#acd542",
  Ukrudtsbekæmpelse: "#800000",
  Skadedyrsbekæmpelse: "#42d4f4",
  Bilpleje: "#c593fe",
  Administrativt: "#9A6324",
  Andet: "#000000",
};

export type CategoryName = keyof typeof CATEGORIES;

export function categoryColor(name: string): string {
  return CATEGORIES[name] ?? "#888888";
}

// Egen kategori (Thomas 2026-09-10): en opgave behøver ikke passe i de 15
// faste kategorier. Hver kategori har en fast farve (første bogstav peger
// deterministisk ind i paletten), så chips forbliver læsbare.
export const EGEN_KATEGORI = "Egen kategori";

const CHIP_TEXT_DARK = new Set([
  "Overfladerens", // #e5c700 (gul)
  "Grøn service", // #acd542 (lys grøn)
  "Skadedyrsbekæmpelse", // #42d4f4 (lys cyan)
  "Algebehandling", // #f58231 (orange, mørk tekst er tydeligst)
]);

const NEW_CATEGORY_COLORS = ["#911eb4", "#469990", "#c593fe", "#3cb44b", "#800000", "#257BB6"];

export function isNewCategoryName(name: string): boolean {
  return !!name && name !== EGEN_KATEGORI && !(name in CATEGORIES);
}

export function chipTextColor(category: string): string {
  return CHIP_TEXT_DARK.has(category) ? "rgba(28, 20, 11, 0.9)" : "#ffffff";
}

export function newCategoryColor(name: string): string {
  const code = (name[0] ?? "A").toUpperCase().charCodeAt(0);
  return NEW_CATEGORY_COLORS[code % NEW_CATEGORY_COLORS.length];
}

export function chipBackground(category: string): string {
  return CATEGORIES[category] ?? newCategoryColor(category);
}
