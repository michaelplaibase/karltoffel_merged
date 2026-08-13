export const ADDRESS_FINDER_ENDPOINT = "/api/address-search?text=";
export const ADDRESS_FINDER_DEBOUNCE_MS = 250;

export type CanonicalAddress = { label: string; street: string; house: string; floorDoor: string; postcode: string; city: string; providerId: string | null; coordinate: readonly [number, number] | null };

export type AdressevaelgerHit = { titel?: string; id?: string; type?: string; vejnavn?: string; husnummer?: string; x?: number; y?: number };

export function parseAdressevaelgerHit(hit: AdressevaelgerHit): CanonicalAddress | null {
  if (hit.type !== "husnummer" || !hit.titel) return null;
  const title = hit.titel.trim();
  const location = title.match(/,\s*(\d{4})\s+([^,]+)$/);
  const leading = hit.vejnavn?.trim() && hit.husnummer?.trim()
    ? { street: hit.vejnavn.trim(), houseAndFloor: hit.husnummer.trim() }
    : (() => {
        const match = title.match(/^(.+?)\s+(\d+[A-Za-z]?(?:\s+[^,]+)?)\s*,/);
        return match ? { street: match[1], houseAndFloor: match[2] } : null;
      })();
  if (!leading || !location) return null;
  const houseParts = leading.houseAndFloor.split(/\s+/);
  return { label: title, street: leading.street, house: houseParts.shift()!, floorDoor: houseParts.join(" "), postcode: location[1], city: location[2].trim(), providerId: hit.id ?? null,
    coordinate: Number.isFinite(hit.y) && Number.isFinite(hit.x) ? [Number(hit.y), Number(hit.x)] : null };
}

export const addressForContactFields = (address: CanonicalAddress) => ({ street: `${address.street} ${address.house}${address.floorDoor ? ` ${address.floorDoor}` : ""}`, city: `${address.postcode} ${address.city}` });
