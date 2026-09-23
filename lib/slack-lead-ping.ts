// Slack-ping for nye leads: post kortet til #leads, kør én automatisk
// genkørsel på en transient fejl, og returnér udfaldet så route'en kan skrive
// det tilbage på leadet. Ren funktion — ingen DB, ingen anden netværkskode end
// den indsprøjtede `post` — så den kan unit-testes uden Slack (samme tanke som
// lib/slack-lead.ts).
//
// Hvorfor: hvis Slack afviser (forkert/forældet SLACK_LEADS_CHANNEL-id, bot
// ikke med i kanalen, manglende chat:write-scope, ugyldigt token), ville fejlen
// førhen kun lande i en console.error i Vercels runtime-logs — en ikke-teknisk
// bruger ser dem aldrig, og leadet blev bare gemt stille. Nu returneres
// status+fejl herfra og gemmes i lead.payload (lib/tilbudsmotor-pricing.ts)
// så CRM'ets Emner-liste kan vise præcis hvilke leads der ikke nåede #leads og
// hvorfor.
import { postMessage, type SlackResult } from "@/lib/slack";
import { parseLeadPayload, serializeLeadPayload } from "@/lib/tilbudsmotor-pricing";
import { buildLeadBlocks, leadFallbackText, type LeadLike } from "@/lib/slack-lead";

export type { SlackResult } from "@/lib/slack";

export type SlackOutcome = {
  status: "posted" | "simulated" | "failed";
  error?: string;
  /** Lead.payload opdateret med slackStatus/slackError/slackPostedAt. Skriv den
   *  tilbage på leadet (posted/failed) — er "simulated" er den uændret. */
  payload: string;
};

export type PingFn = (input: { text: string; blocks?: unknown[] }) => Promise<SlackResult>;

/** Post til #leads med én genkørsel mod transient fejl (rate-limit, timeout o.l.),
 *  inden vi opgiver og markerer leadet som failed. */
export async function pingSlack(
  lead: LeadLike,
  payloadJson: string | null,
  advarsel?: string,
  post: PingFn = (input) => postMessage(input),
): Promise<SlackOutcome> {
  const p = parseLeadPayload(payloadJson);
  const build = () => ({
    text: leadFallbackText(lead, p),
    blocks: buildLeadBlocks(lead, p, advarsel ? { advarsel } : {}),
  });
  const attempt = () => post(build());

  try {
    let res = await attempt();
    if (!res.ok && !res.simulated) {
      // Én genkørsel — Slack afviser ofte transient (rate_limit m.fl.).
      res = await attempt();
    }
    if (res.simulated) {
      return { status: "simulated", payload: payloadJson ?? "" };
    }
    if (!res.ok) {
      const err = res.error || "ukendt slack-fejl";
      return {
        status: "failed",
        error: err,
        payload: serializeLeadPayload({
          ...p, slackStatus: "failed", slackError: err, slackPostedAt: new Date().toISOString(),
        }),
      };
    }
    return {
      status: "posted",
      payload: serializeLeadPayload({ ...p, slackStatus: "posted", slackPostedAt: new Date().toISOString() }),
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : "slack-ping exception";
    return {
      status: "failed",
      error: err,
      payload: serializeLeadPayload({
        ...p, slackStatus: "failed", slackError: err, slackPostedAt: new Date().toISOString(),
      }),
    };
  }
}