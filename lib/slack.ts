// Slack-transport til lead-godkendelsesfloejet. Ren REST + fetch, intet SDK
// (samme bevidst dependency-frie moenster som lib/email.ts og lib/gcal.ts).
//
// Dry-run by default: er SLACK_BOT_TOKEN eller SLACK_LEADS_CHANNEL ikke sat,
// logges der og returneres { ok:true, simulated:true }. Intet naar Slack, foer
// noeglerne er konfigureret paa Vercel.
//
// Env:
//   SLACK_BOT_TOKEN       xoxb-... botto­ken med chat:write (+ views:write til modal)
//   SLACK_SIGNING_SECRET  verificerer at indgaaende kald FAKTISK kommer fra Slack
//   SLACK_LEADS_CHANNEL   kanal-id for #kundeservice (fx C0123ABCD)
//   SLACK_APPROVER_USER   Slack-bruger-id der taggen i beskeden (fx U0123ABCD)
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://slack.com/api";

export type SlackResult = { ok: boolean; simulated?: boolean; ts?: string; channel?: string; error?: string };

export function slackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN?.trim() && process.env.SLACK_LEADS_CHANNEL?.trim());
}

/** Kanal og godkender laeses ét sted, saa kalderne slipper for env-detaljer. */
export function leadsChannel(): string {
  return (process.env.SLACK_LEADS_CHANNEL || "").trim();
}
export function approverMention(): string {
  const u = (process.env.SLACK_APPROVER_USER || "").trim();
  return u ? `<@${u}>` : "";
}

async function call(method: string, body: unknown): Promise<SlackResult> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return { ok: false, error: "SLACK_BOT_TOKEN mangler" };
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok?: boolean; ts?: string; channel?: string; error?: string };
    if (!json.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, ts: json.ts, channel: typeof json.channel === "string" ? json.channel : undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Slaa en besked op i #kundeservice. `blocks` er Slacks Block Kit-struktur. */
export async function postMessage(text: string, blocks?: unknown[]): Promise<SlackResult> {
  const channel = leadsChannel();
  if (!slackConfigured()) {
    console.log(`[slack:dry-run] post -> ${channel || "(ingen kanal)"}: ${text.slice(0, 120)}`);
    return { ok: true, simulated: true, channel };
  }
  return call("chat.postMessage", { channel, text, blocks, unfurl_links: false });
}

/** Opdater en besked paa plads, saa traaden ikke fyldes med gentagelser. */
export async function updateMessage(channel: string, ts: string, text: string, blocks?: unknown[]): Promise<SlackResult> {
  if (!slackConfigured()) {
    console.log(`[slack:dry-run] update ${ts}: ${text.slice(0, 120)}`);
    return { ok: true, simulated: true };
  }
  return call("chat.update", { channel, ts, text, blocks });
}

/** Aabn en modal (bruges til "Ret udkast"-feedbacken). */
export async function openModal(triggerId: string, view: unknown): Promise<SlackResult> {
  if (!slackConfigured()) {
    console.log("[slack:dry-run] openModal");
    return { ok: true, simulated: true };
  }
  return call("views.open", { trigger_id: triggerId, view });
}

/** Slaa en besked op i traaden under en eksisterende besked. */
export async function postInThread(channel: string, threadTs: string, text: string): Promise<SlackResult> {
  if (!slackConfigured()) {
    console.log(`[slack:dry-run] thread ${threadTs}: ${text.slice(0, 120)}`);
    return { ok: true, simulated: true };
  }
  return call("chat.postMessage", { channel, thread_ts: threadTs, text, unfurl_links: false });
}

/** Verificér at et indgaaende kald kommer fra Slack (v0-signaturen).
 *  Fejler LUKKET: uden signing secret afvises alt, ellers kunne hvem som helst
 *  poste godkendelser til endpointet. Afviser ogsaa gamle tidsstempler (replay). */
export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false; // over 5 min gammel = replay

  const mine = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(mine, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
