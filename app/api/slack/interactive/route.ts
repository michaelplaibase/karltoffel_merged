import { after } from "next/server";
import { verifySlackSignature, openModal, postInThread } from "@/lib/slack";
import { approveReply, reviseReply } from "@/lib/lead-slack";

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

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  if (!verifySlackSignature(raw, req.headers.get("x-slack-request-timestamp"), req.headers.get("x-slack-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }

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
        await openModal(trigger, {
          type: "modal",
          callback_id: "lead_feedback",
          private_metadata: String(replyId),
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
    const replyId = Number(payload.view.private_metadata);
    const feedback = (payload.view.state?.values?.fb?.txt?.value || "").trim();
    if (Number.isInteger(replyId) && replyId > 0 && feedback) {
      after(() => reviseReply(replyId, feedback, user));
    }
    // Luk modalen med det samme. Det nye udkast opdaterer kanalbeskeden bagefter.
    return new Response(JSON.stringify({ response_action: "clear" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return ok();
}
