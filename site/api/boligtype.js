// Boligtype-opslag til tilbudsmotoren (privat-flow): slår en adresse op i BBR og
// afgør om ejendommen er en VILLA (enfamiliehus/parcelhus/række-/kædehus) eller
// et SOMMERHUS, så pakkevalget kan forvælge Villapakken hhv. Sommerhuspakken.
//
// Kilde: DAWA's gratis bbrlight (api.dataforsyningen.dk) — åbne endpoints, ingen
// nøgle. Bemærk: DAWA's BBR-data er FROSSET (dec-2023), så helt nye/omklassifi-
// cerede huse kan ramme forkert. Det er acceptabelt: boligtypen FORVÆLGER kun et
// kort — kunden ser stadig alle kort og kan skifte. Derfor fejler dette endpoint
// ALDRIG hårdt: enhver fejl → {boligtype:null}, og motoren defaulter til villa.
//
// Samme oprindelse som sitet → ingen CORS nødvendig. Node serverless (som lead.js).
const DAWA = "https://api.dataforsyningen.dk";

/** Hent med timeout (BBR kan hænge) — aldrig længere end klienten vil vente. */
async function getJson(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** BBR-anvendelseskode → grov boligtype. 110–139 = helårs enfamilie-/række-/
 *  kædehus (villa-familien); 510/540/585 = sommerhus/kolonihave/fritidshus. */
function classify(kode) {
  const n = parseInt(String(kode == null ? "" : kode).trim(), 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 110 && n <= 139) return "villa";
  if (n === 510 || n === 540 || n === 585) return "sommerhus";
  return null;
}

/** Læs bygningens anvendelseskode. bbrlight bruger BYG_ANVEND_KODE; hvis
 *  feltnavnet skulle afvige, scannes efter en nøgle der indeholder "anvend". */
function useCodeOf(b) {
  if (!b || typeof b !== "object") return null;
  if (b.BYG_ANVEND_KODE != null && String(b.BYG_ANVEND_KODE).trim()) return String(b.BYG_ANVEND_KODE).trim();
  for (const k of Object.keys(b)) {
    if (/anvend/i.test(k)) {
      const v = b[k];
      if (v != null && /^\d{2,4}$/.test(String(v).trim())) return String(v).trim();
    }
  }
  return null;
}

/** Bebygget areal — bruges til at vælge HOVEDbygningen når der er flere. */
function areaOf(b) {
  const v = b && (b.BYG_BEBYG_ARL != null ? b.BYG_BEBYG_ARL : b.BYG_BOLIG_ARL);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = req.query || {};
  let id = typeof q.id === "string" ? q.id.trim() : "";
  const address = typeof q.address === "string" ? q.address.trim() : "";

  try {
    // 1) Adresse → adgangsadresse-id (springes over hvis id allerede er givet).
    if (!id) {
      if (address.length < 3) return res.status(200).json({ ok: false, boligtype: null });
      const hits = await getJson(`${DAWA}/adgangsadresser?per_side=1&struktur=mini&q=${encodeURIComponent(address)}`);
      id = Array.isArray(hits) && hits[0] && hits[0].id ? String(hits[0].id) : "";
      if (!id) return res.status(200).json({ ok: false, boligtype: null });
    }

    // 2) adgangsadresse-id → BBR-bygninger → hovedbygningens anvendelse.
    const buildings = await getJson(`${DAWA}/bbrlight/bygninger?adgangsadresseid=${encodeURIComponent(id)}`);
    if (!Array.isArray(buildings) || !buildings.length) return res.status(200).json({ ok: false, boligtype: null, id });

    let boligtype = null, kode = null, bestArea = -1;
    for (const b of buildings) {
      const k = useCodeOf(b);
      const cls = classify(k);
      if (!cls) continue;
      const a = areaOf(b);
      if (a > bestArea) { bestArea = a; boligtype = cls; kode = k; }
    }

    // Korttids-cache: BBR er stort set statisk, og samme adresse slås ofte op igen.
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return res.status(200).json({ ok: boligtype != null, boligtype, kode, id });
  } catch (e) {
    console.error("[boligtype] uventet fejl:", e && e.message);
    return res.status(200).json({ ok: false, boligtype: null });
  }
};
