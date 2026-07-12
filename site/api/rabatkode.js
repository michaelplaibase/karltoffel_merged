// Rabatkode-relay: browseren spørger hertil (GET /api/rabatkode?code=X), og VI
// spørger CRM'ets validerings-endpoint server-side. Read-only — ingen secret
// nødvendig. Svaret er ALTID JSON { valid, percent }: enhver fejl/timeout
// bliver til { valid:false, percent:0 }, så et dødt CRM aldrig vælter flowet.
//
// Env (samme variabel som api/lead.js):
//   CRM_LEADS_URL — valgfri override; default er produktions-CRM'et.
//                   CRM-basen (uden /api/leads) genbruges til valideringen.
const CRM_LEADS_URL = process.env.CRM_LEADS_URL || "https://karltoffel-crm.vercel.app/api/leads";
const CRM_BASE = CRM_LEADS_URL.replace(/\/api\/leads\/?$/, "");

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const nej = () => res.status(200).json({ valid: false, percent: 0 });
  const code = typeof (req.query && req.query.code) === "string" ? req.query.code.trim() : "";
  if (!code || code.length > 64) return nej();

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000); // hængende CRM må ikke hænge kunden
    const upstream = await fetch(
      CRM_BASE + "/api/discount-codes/validate?code=" + encodeURIComponent(code),
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!upstream.ok) return nej();
    const data = await upstream.json().catch(() => null);
    const valid = !!(data && data.valid === true);
    let percent = valid ? Number(data.percent) : 0;
    if (!Number.isFinite(percent) || percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    return res.status(200).json({ valid, percent });
  } catch (e) {
    return nej(); // netværksfejl/timeout — aldrig en rå fejl ud til browseren
  }
};
