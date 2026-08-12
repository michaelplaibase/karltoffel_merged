// CVR-opslag til erhvervs-trinnet i tilbudsmotoren.
//
// Browseren spørger hertil (GET /api/cvr?cvr=XXXXXXXX), og VI slår op hos
// cvrapi.dk server-side (ingen nøgle nødvendig på deres gratis tier, men
// kravet er en beskrivende User-Agent — se docs). Samme mønster som
// api/rabatkode.js: read-only relay, ALDRIG en rå fejl/timeout ud til
// browseren, og et dødt/kvote-opbrugt CVR-API må aldrig vælte flowet —
// kunden taster firmanavn + adresse manuelt i stedet.
//
// Svarform (altid 200 ved velformet CVR, aldrig upstreamens rå fejl):
//   Fundet:       { found: true,  name, address, zipcode, city }
//   Ikke fundet:  { found: false, reason: "not_found" }
//   API nede/kvote/timeout: { found: false, reason: "unavailable" }
// Ugyldigt CVR-format (ikke 8 cifre) → 400 { error: "..." }, da det er en
// klientfejl (motoren skal kun kalde os efter validering, men vi validerer
// også selv — cvrapi.dk er lemfældig med sit eget "search"-parameter og vil
// ellers matche delvist på færre end 8 cifre).
const CVR_RE = /^\d{8}$/;

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cvr = typeof (req.query && req.query.cvr) === "string" ? req.query.cvr.trim() : "";
  if (!CVR_RE.test(cvr)) {
    return res.status(400).json({ error: "CVR skal være 8 cifre" });
  }

  const utilgaengelig = () => res.status(200).json({ found: false, reason: "unavailable" });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000); // hængende upstream må ikke hænge kunden
    let upstream;
    try {
      upstream = await fetch(
        "https://cvrapi.dk/api?search=" + encodeURIComponent(cvr) + "&country=dk",
        {
          signal: ctrl.signal,
          // cvrapi.dk kræver en beskrivende UA på gratis tier — ellers 403.
          headers: { "User-Agent": "karltoffel.dk tilbudsmotor (hej@karltoffel.dk)" },
        }
      );
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status === 404) {
      return res.status(200).json({ found: false, reason: "not_found" });
    }
    if (!upstream.ok) {
      // 403/429/5xx fra cvrapi.dk (kvote opbrugt, nede, o.l.) — degrader roligt,
      // lad ALDRIG deres rå fejlbesked/status ud til browseren.
      console.error("[cvr] upstream HTTP", upstream.status);
      return utilgaengelig();
    }

    const data = await upstream.json().catch(() => null);
    if (!data || typeof data.name !== "string" || !data.name) {
      return res.status(200).json({ found: false, reason: "not_found" });
    }

    return res.status(200).json({
      found: true,
      name: String(data.name),
      address: typeof data.address === "string" ? data.address : "",
      zipcode: typeof data.zipcode === "string" ? data.zipcode : (data.zipcode != null ? String(data.zipcode) : ""),
      city: typeof data.city === "string" ? data.city : "",
    });
  } catch (e) {
    console.error("[cvr] uventet fejl/timeout:", e && e.message);
    return utilgaengelig();
  }
};
