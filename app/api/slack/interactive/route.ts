import { after } from "next/server";
import { verifySlackSignature, openModal, postInThread } from "@/lib/slack";
import { approveReply, reviseReply, leadSlackEnabled } from "@/lib/lead-slack";

// Slacks interaktivitets-endpoint: her lander tryk paa "Godkend og send" og
// "Ret udkast", samt indsendelsen af feedback-modalen.
//
// Saet URL'en her i Slack-appen under Interactivity & Shortcuts:
//   https://<crm>/api/slack/interactive
//
// Sikkerhed: middleware ekskluderer /api, saa ruten tjekker SELV at kaldet
// kommer fra Slack via v0-signaturen (lib/slack.ts). Fejler LUKKET, uden
// SLACK_SIGNING_SECRET afvises alt.
//
// Slack kraever svar inden for 3 sekunder, men et AI-udkast tager laengere.
// Derfor kvitteres der med det samme, og arbejdet koeres i after(), som Next
// afvikler efter svaret er sendt.

export const maxDuration = 60; // after()-arbejdet (AI + mail) skal kunne naa at loebe faerdigt

type SlackAction = { action_id?: string; value?: string };
type SlackPayload = {
  type?: string;
  user?: { id?: string };
  trigger_id?: string;
  actions?: SlackAction[];
  view?: { private_metadata?: string; state?: { values?: Record<string, Record<string, { value?: string }>> } };
  channel?: { id?: string };
  message?: { ts?: string };
};

const ok = () => new Response("", { status: 200 });

/** Kun den udpegede godkender maa trykke. Er SLACK_APPROVER_USER ikke sat, er
 *  der ingen udpeget, og saa maa alle i kanalen (kanalen er adgangskontrollen). */
function maaGodkende(userId: string): boolean {
  const approver = (process.env.SLACK_APPROVER_USER || "").trim();
  return !approver || approver === userId;
}

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  if (!verifySlackSignature(raw, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }

  // Hovedafbryderen skal ogsaa gaelde HER, ikke kun ved opslag. Ellers kunne en
  // gammel besked i kanalen stadig sende en mail, efter floejet var slukket.
  if (!leadSlackEnabled()) return ok();

  // Slack proever igen hvis den ikke fik svar i tide. Arbejdet er allerede
  // idempotent via den atomiske reservation i lead-slack.ts, men et retry skal
  // ikke koere hele turen igen for ingenting.
  if (req.headers.get("x-slack-retry-num")) return ok();

  // Slack sender interaktioner som form-encoded med ét felt: payload=<json>.
  let payload: SlackPayload;
  try {
    payload = JSON.parse(new URLSearchParams(raw).get("payload") || "{}") as SlackPayload;
  } catch {
    return new Response("bad payload", { status: 400 });
  }

  const user = payload.user?.id || "ukendt";

  // 1) Knaptryk i kanalen.
  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    const replyId = Number(action?.value);
    if (!Number.isInteger(replyId) || replyId <= 0) return ok();

    if (action?.action_id === "lead_approve") {
      const channel = payload.channel?.id, ts = payload.message?.ts;
      if (!maaGodkende(user)) {
        if (channel && ts) await postInThread(channel, ts, `<@${user}> maa ikke godkende svar. Det skal godkenderen selv gøre.`);
        return ok();
      }
      after(async () => {
        const res = await approveReply(replyId, user);
        if (!res.ok && channel && ts) await postInThread(channel, ts, `Kunne ikke sende: ${res.error}`);
      });
      return ok();
    }

    if (action?.action_id === "lead_revise") {
      // Modalen skal aabnes MENS trigger_id er frisk (den udloeber paa faa
      // sekunder), saa den kan ikke vente til after().
      const trigger = payload.trigger_id;
      if (trigger) {
        // Kanal og besked-ts baeres med gennem modalen, saa en fejl ved
        // genskrivningen kan meldes tilbage i den rigtige traad.
        await openModal(trigger, {
          type: "modal",
          callback_id: "lead_feedback",
          private_metadata: `${replyId}:${payload.channel?.id ?? ""}:${payload.message?.ts ?? ""}`,
          title: { type: "plain_text", text: "Ret udkastet" },
          submit: { type: "plain_text", text: "Skriv nyt udkast" },
          close: { type: "plain_text", text: "Fortryd" },
          blocks: [
            {
              type: "input",
              block_id: "fb",
              label: { type: "plain_text", text: "Hvad skal laves om?" },
              element: {
                type: "plain_text_input",
                action_id: "txt",
                multiline: true,
                placeholder: { type: "plain_text", text: "Fx: for langt, og drop det med prisgarantien" },
              },
            },
          ],
        });
      }
      return ok();
    }

    return ok(); // fx "Åbn i CRM", et rent link-tryk der bare skal kvitteres
  }

  // 2) Feedback-modalen indsendt: skriv en ny version.
  if (payload.type === "view_submission" && payload.view?.private_metadata) {
    const meta = payload.view.private_metadata.split(":");
    const replyId = Number(meta[0]);
    const channel = meta[1] || "", ts = meta[2] || "";
    const feedback = (payload.view.state?.values?.fb?.txt?.value || "").trim();
    if (Number.isInteger(replyId) && replyId > 0 && feedback) {
      after(async () => {
        // Fejl her maa ikke forsvinde tavst: uden besked ville godkenderen tro
        // at et nyt udkast var paa vej, mens kanalbeskeden stod uaendret.
        const res = await reviseReply(replyId, feedback, user);
        if (!res.ok && channel && ts) await postInThread(channel, ts, `Kunne ikke skrive nyt udkast: ${res.error}`);
      });
    }
    // Luk modalen med det samme. Det nye udkast opdaterer kanalbeskeden bagefter.
    return new Response(JSON.stringify({ response_action: "clear" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return ok();
}
