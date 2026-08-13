export const ADDRESS_FINDER_ENDPOINT = "/api/address-search?text=";
export const ADDRESS_FINDER_DEBOUNCE_MS = 250;

export type CanonicalAddress = { label: string; street: string; house: string; floorDoor: string; postcode: string; city: string; providerId: string | null; coordinate: readonly [number, number] | null };

export function parseAdressevaelgerHit(hit: { titel?: string; id?: string; type?: string; x?: number; y?: number }): CanonicalAddress | null {
  if (hit.type !== "husnummer" || !hit.titel) return null;
  const match = hit.titel.trim().match(/^(.+?)\s+(\d+[A-Za-z]?(?:\s+[^,]+)?)\s*,\s*(\d{4})\s+(.+)$/);
  if (!match) return null;
  const houseParts = match[2].split(/\s+/);
  return { label: hit.titel.trim(), street: match[1], house: houseParts.shift()!, floorDoor: houseParts.join(" "), postcode: match[3], city: match[4], providerId: hit.id ?? null,
    coordinate: Number.isFinite(hit.y) && Number.isFinite(hit.x) ? [Number(hit.y), Number(hit.x)] : null };
}

export const addressForContactFields = (address: CanonicalAddress) => ({ street: `${address.street} ${address.house}${address.floorDoor ? ` ${address.floorDoor}` : ""}`, city: `${address.postcode} ${address.city}` });
