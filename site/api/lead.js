// Lead-relay: tilbudsmotoren (browseren) poster hertil, og VI poster videre til
// CRM'ets webhook med den delte secret. Secret'en må aldrig ligge i browser-JS —
// derfor dette lille server-hop (Vercel serverless function, zero-config).
//
// Env (sættes på SITETS Vercel-projekt):
//   LEAD_WEBHOOK_SECRET  — samme værdi som på CRM'et (32+ tegn). Uden den: 503.
//   CRM_LEADS_URL        — valgfri override; default er produktions-CRM'et.
const CRM_LEADS_URL = process.env.CRM_LEADS_URL || "https://karltoffel-crm.vercel.app/api/leads";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.LEAD_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    // Fail closed men venligt — kunden skal ikke se en rå 500.
    return res.status(503).json({ error: "Lead-modtagelsen er ikke konfigureret endnu" });
  }

  const body = req.body;
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid JSON" });
  // Grov størrelses- og formkontrol her; CRM'et validerer felterne igen.
  let raw;
  try { raw = JSON.stringify(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  if (raw.length > 9_000) return res.status(400).json({ error: "Payload too large" });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!name || (!email && !phone)) return res.status(400).json({ error: "name + email/phone required" });

  const clientIp = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";

  try {
    const upstream = await fetch(CRM_LEADS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-karltoffel-secret": secret,
        "x-forwarded-for": clientIp, // CRM'ets rate-limit skal se kundens IP, ikke relayets
      },
      body: raw,
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    console.error("[lead-relay] CRM unreachable:", e && e.message);
    return res.status(502).json({ error: "Kunne ikke nå CRM'et" });
  }
};
