// Slack-transport: send besked, åbn/opdatér dialog, og verificér at et
// indkommende kald FAKTISK kommer fra Slack. Ingen SDK, kun fetch + Web Crypto
// — samme mønster som lib/email.ts, så afhængighedslisten bliver ikke længere.
//
// Dry-run som standard: uden SLACK_BOT_TOKEN logges beskeden og der returneres
// { ok:true, simulated:true }. Det holder dev/preview stille og betyder at
// intet nogensinde poster til den rigtige kanal før tokenet er sat på Vercel.
//
// SLACK_BOT_TOKEN      = "xoxb-..." fra din Slack-app under OAuth & Permissions.
//                        Scopes der skal til: chat:write, commands.
// SLACK_SIGNING_SECRET = fra Basic Information → App Credentials. Bruges til at
//                        verificere signaturen på interaktioner. Uden den
//                        AFVISES alt indkommende (fail closed) — vi vil aldrig
//                        have et åbent endpoint der kan sende tilbud ud.
// SLACK_LEADS_CHANNEL  = kanal-id eller "#leads" (default "#leads").

export type SlackResult = { ok: boolean; simulated?: boolean; ts?: string; channel?: string; error?: string };

const API = "https://slack.com/api";

function token(): string | undefined {
  const t = process.env.SLACK_BOT_TOKEN?.trim();
  return t || undefined;
}

export function leadsChannel(): string {
  return process.env.SLACK_LEADS_CHANNEL?.trim() || "#leads";
}

/** Kald Slacks Web API. Slack svarer ALTID HTTP 200 — fejlen ligger i
 *  { ok:false, error:"..." } i kroppen, så begge lag skal tjekkes. */
async function call(method: string, body: unknown): Promise<{ ok: boolean; error?: string; data: Record<string, unknown> }> {
  const t = token();
  if (!t) return { ok: false, error: "no-token", data: {} };
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: `http ${res.status}`, data };
    if (data.ok !== true) return { ok: false, error: String(data.error ?? "ukendt slack-fejl"), data };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "slack-kald fejlede", data: {} };
  }
}

/** Post en besked. `text` er fallback til notifikationer og skærmlæsere —
 *  udfyld den altid, også når blocks bærer indholdet. */
export async function postMessage(input: {
  channel?: string;
  text: string;
  blocks?: unknown[];
}): Promise<SlackResult> {
  const channel = input.channel || leadsChannel();
  if (!token()) {
    console.log(`[slack:dry-run] channel=${channel} text=${JSON.stringify(input.text.slice(0, 200))}`);
    return { ok: true, simulated: true, channel };
  }
  const r = await call("chat.postMessage", { channel, text: input.text, ...(input.blocks ? { blocks: input.blocks } : {}) });
  if (!r.ok) return { ok: false, error: r.error, channel };
  return { ok: true, ts: typeof r.data.ts === "string" ? r.data.ts : undefined, channel };
}

/** Erstat en besked på plads (fx efter godkendelse, så knapperne forsvinder og
 *  ikke kan trykkes to gange). */
export async function updateMessage(input: {
  channel: string;
  ts: string;
  text: string;
  blocks?: unknown[];
}): Promise<SlackResult> {
  if (!token()) {
    console.log(`[slack:dry-run] update ${input.channel}/${input.ts}`);
    return { ok: true, simulated: true };
  }
  const r = await call("chat.update", {
    channel: input.channel, ts: input.ts, text: input.text,
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Åbn en dialog. trigger_id er gyldigt i 3 sekunder efter klikket, så dette
 *  kald skal ske FØR alt andet arbejde i handleren. */
export async function openView(triggerId: string, view: unknown): Promise<SlackResult> {
  if (!token()) {
    console.log(`[slack:dry-run] views.open trigger=${triggerId.slice(0, 12)}…`);
    return { ok: true, simulated: true };
  }
  const r = await call("views.open", { trigger_id: triggerId, view });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Send en efterfølgende besked til den kanal/tråd et klik kom fra, via det
 *  response_url Slack leverer i payloadet. Virker uden bot-token og uden for
 *  3-sekundersvinduet (gyldigt i 30 min, 5 svar). */
export async function respond(responseUrl: string, body: { text: string; blocks?: unknown[]; replace_original?: boolean; response_type?: "in_channel" | "ephemeral" }): Promise<boolean> {
  try {
    const res = await fetch(responseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[slack] response_url fejlede:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Signaturverifikation
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

/** Konstant-tid sammenligning af to hex-strenge. Samme idiom som secretOk() i
 *  app/api/leads/route.ts: hash begge sider og XOR de fastlængde-digests, så
 *  længde og indhold ikke kan læses ud af svartiden. */
async function equalConstantTime(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ua = new Uint8Array(da), ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type VerifyResult = "ok" | "unconfigured" | "bad-signature" | "stale" | "malformed";

/** Verificér Slacks v0-signatur over den RÅ request-body.
 *
 *  Vigtigt: body SKAL være den uparsede tekst. Læser man JSON/form-data først
 *  og serialiserer igen, ændres bytes og signaturen slår fejl.
 *
 *  Tidsstemplet må højst være 5 minutter gammelt (Slacks egen anbefaling) —
 *  det er værnet mod at en opsnappet request kan gemmes og genbruges senere. */
export async function verifySlackRequest(headers: Headers, rawBody: string): Promise<VerifyResult> {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) return "unconfigured";

  const sig = headers.get("x-slack-signature");
  const ts = headers.get("x-slack-request-timestamp");
  if (!sig || !ts || !/^\d+$/.test(ts)) return "malformed";

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (ageSec > 300) return "stale";

  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`v0:${ts}:${rawBody}`));
  const expected = `v0=${hex(mac)}`;

  return (await equalConstantTime(sig, expected)) ? "ok" : "bad-signature";
}
