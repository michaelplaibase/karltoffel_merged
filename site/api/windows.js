// AI-vinduestælling til tilbudsmotoren.
//
// Tilbudsmotoren renderer skråfoto af ejendommen på et <canvas> og sender
// billedet (base64) hertil. Vi beder en vision-model tælle synlige vinduesruder
// (glas) på facaderne og returnerer et estimat, som motoren bruger som mængde
// for "Vinduespudsning udvendig" (prissættes pr. glas). Estimatet bekræftes
// altid på opkaldet — det er et udgangspunkt, ikke en bindende pris.
//
// Nøglen bor KUN på serveren (Vercel serverless function), aldrig i browseren.
// Env (sættes på SITETS Vercel-projekt):
//   ANTHROPIC_API_KEY — uden den kører endpointet i "dry-run" og returnerer
//                       {simulated:true}; motoren falder tilbage til sit
//                       standard-glasantal (samme mønster som lib/email.ts).
//
// Samme oprindelse som sitet → ingen CORS nødvendig.

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const OK_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Struktureret output → pålideligt heltal i stedet for fri tekst.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["panes", "confidence"],
  properties: {
    panes: { type: "integer", description: "Estimeret samlet antal synlige vinduesruder (glas) på husets facader" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
};

const PROMPT =
  "Dette er et skråfoto (luftfoto set fra siden) af en dansk bolig. " +
  "Vi tilbyder udvendig vinduespudsning og afregner pr. rude (glas). " +
  "Tæl de synlige vinduer på de facader, du kan se, og giv et samlet estimat af " +
  "antal vinduesruder (glas) på HELE huset — medregn også de facader, der ikke er " +
  "synlige på dette ene foto, ud fra husets størrelse og form. Et typisk dansk " +
  "vindue har 1–3 ruder. Se bort fra tagvinduer/ovenlys. Er du i tvivl, giv et " +
  "forsigtigt (lavt) estimat. Svar kun i det angivne JSON-format.";

function parseImage(input) {
  if (typeof input !== "string" || !input) return null;
  let media = "image/jpeg";
  let data = input;
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(input);
  if (m) { media = m[1].toLowerCase(); data = m[2]; }
  data = data.replace(/\s+/g, ""); // base64 skal være uden linjeskift
  if (!OK_MEDIA.has(media)) return null;
  if (data.length < 100 || data.length > 6_000_000) return null; // ~<4.5 MB, over Vercels body-loft
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { media, data };
}

async function countPanes(media, data) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, simulated: true, source: "dry-run" };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media, data } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[windows] Anthropic HTTP", res.status, detail.slice(0, 300));
    return { ok: false, source: "error" };
  }
  const msg = await res.json();
  const textBlock = Array.isArray(msg.content) ? msg.content.find((b) => b.type === "text") : null;

  // TEMP diagnostik (fjernes efter vi har fanget en soft-fail-source) — ingen hemmeligheder.
  const logWindows = (source, panes) => console.log("[windows]", JSON.stringify({
    status: res.status,
    stop_reason: msg.stop_reason,
    stop_details: msg.stop_details ?? null,
    source,
    panes: panes ?? null,
    text: textBlock ? String(textBlock.text).slice(0, 300) : null,
  }));

  // Sikkerhedsafvisning e.l. → intet brugbart svar; motoren falder tilbage.
  if (msg.stop_reason === "refusal") { logWindows("refusal"); return { ok: false, source: "refusal" }; }

  if (!textBlock) { logWindows("empty"); return { ok: false, source: "empty" }; }
  let out;
  try { out = JSON.parse(textBlock.text); } catch { logWindows("unparsable"); return { ok: false, source: "unparsable" }; }
  const panes = Math.round(Number(out && out.panes));
  if (!Number.isFinite(panes) || panes < 1 || panes > 300) { logWindows("out-of-range", panes); return { ok: false, source: "out-of-range" }; }

  logWindows("ai", panes);
  return { ok: true, source: "ai", panes, confidence: out.confidence || "low" };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = req.body;
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid JSON" });

  const img = parseImage(body.imageBase64);
  if (!img) return res.status(400).json({ error: "imageBase64 (base64/data-URL, jpeg/png/webp) required" });

  try {
    const result = await countPanes(img.media, img.data);
    // Aldrig en hård fejl mod browseren — motoren skal bare falde tilbage.
    return res.status(200).json(result);
  } catch (e) {
    console.error("[windows] uventet fejl:", e && e.message);
    return res.status(200).json({ ok: false, source: "exception" });
  }
};
