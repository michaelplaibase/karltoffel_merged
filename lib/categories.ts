// The 15 Fenster task categories. Each drives the colored letter-chip shown on
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
