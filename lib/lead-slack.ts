// Godkendelsesfloejet for svar paa leads:
//
//   nyt lead -> AI skriver udkast -> beskeden slaas op i #kundeservice og tagger
//   godkenderen -> han trykker Godkend (mailen sendes) eller Ret (skriver
//   feedback, AI skriver en ny version) -> gentages til den er god.
//
// Intet gaar til kunden uden et menneskes tryk. Hver runde gemmes som en ny
// LeadReply-raekke, saa forloebet kan laeses bagefter.
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { draftReply, leadSummary, type LeadContext } from "@/lib/lead-draft";
import { postMessage, updateMessage, approverMention, leadsChannel } from "@/lib/slack";

/** Slaaet fra som standard. Saa laenge et andet system haandterer Slack, maa
 *  CRM'et ikke ogsaa poste: kunden ville risikere to mails. Taend foerst naar
 *  det gamle floej er slukket. */
export function leadSlackEnabled(): boolean {
  return process.env.LEAD_SLACK_ENABLED?.trim() === "1";
}

function crmBase(): string {
  return (process.env.CRM_BASE_URL || "https://karltoffel-crm.vercel.app").replace(/\/+$/, "");
}

type StoredPayload = {
  kundetype?: string | null;
  pakkeNavn?: string | null;
  estimat?: { md?: number };
  services?: { navn?: string; qty?: number; enhed?: string; freq?: number }[];
};

type LeadRow = {
  id: number; name: string; email: string | null; phone: string | null;
  address: string | null; message: string | null; payload: string | null;
};

/** Lead-raekke plus dens tilbudsmotor-payload til ét fladt objekt. */
export function leadContextFrom(lead: LeadRow): LeadContext {
  let p: StoredPayload = {};
  try { p = lead.payload ? (JSON.parse(lead.payload) as StoredPayload) : {}; } catch { /* korrupt payload ignoreres */ }
  return {
    id: lead.id, name: lead.name, email: lead.email, phone: lead.phone,
    address: lead.address, message: lead.message,
    kundetype: typeof p.kundetype === "string" ? p.kundetype : null,
    pakkeNavn: typeof p.pakkeNavn === "string" ? p.pakkeNavn : null,
    estimatMd: Number(p.estimat?.md) || 0,
    services: (p.services ?? []).flatMap((s) =>
      s && typeof s.navn === "string"
        ? [{ navn: s.navn, qty: Number(s.qty) || 0, enhed: String(s.enhed ?? ""), freq: Number(s.freq) || 0 }]
        : []),
  };
}

/** Citer teksten som Slack-blockquote, saa udkastet er til at skimme. */
function quote(s: string): string {
  return s.split("\n").map((l) => "> " + l).join("\n");
}

function draftBlocks(ctx: LeadContext, reply: { id: number; version: number; subject: string; body: string }): unknown[] {
  const mention = approverMention();
  return [
    { type: "header", text: { type: "plain_text", text: `Nyt lead: ${ctx.name}`.slice(0, 150) } },
    { type: "section", text: { type: "mrkdwn", text: "```" + leadSummary(ctx) + "```" } },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Udkast v${reply.version}*\n*Emne:* ${reply.subject}\n\n${quote(reply.body)}`.slice(0, 2900),
      },
    },
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: { type: "plain_text", text: "Godkend og send" },
          action_id: "lead_approve", value: String(reply.id) },
        { type: "button", text: { type: "plain_text", text: "Ret udkast" },
          action_id: "lead_revise", value: String(reply.id) },
        { type: "button", text: { type: "plain_text", text: "Åbn i CRM" },
          action_id: "lead_open", url: `${crmBase()}/leads` },
      ],
    },
    ...(mention
      ? [{ type: "context", elements: [{ type: "mrkdwn", text: `${mention} skal godkende, før der sendes noget.` }] }]
      : []),
  ];
}

/** Skriv udkast v1 og slaa det op til godkendelse. Maa ALDRIG kaste: et lead
 *  skal gemmes selv om Slack eller AI er nede. */
export async function postLeadForApproval(leadId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, error: "lead findes ikke" };

    const ctx = leadContextFrom(lead);
    const draft = await draftReply(ctx);

    const reply = await prisma.leadReply.create({
      data: {
        leadId, version: 1, subject: draft.subject, body: draft.body,
        status: "draft", model: draft.model, slackChannel: leadsChannel(),
      },
    });

    const posted = await postMessage(`Nyt lead: ${ctx.name}`, draftBlocks(ctx, reply));
    if (posted.ts) {
      await prisma.leadReply.update({
        where: { id: reply.id },
        data: { slackTs: posted.ts, slackChannel: posted.channel ?? leadsChannel() },
      });
    }
    return posted.ok ? { ok: true } : { ok: false, error: posted.error };
  } catch (e) {
    console.error("[lead-slack] postLeadForApproval fejlede:", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

/** Godkendt: send mailen til kunden og laas beskeden. */
export async function approveReply(replyId: number, slackUser: string): Promise<{ ok: boolean; error?: string }> {
  const reply = await prisma.leadReply.findUnique({ where: { id: replyId }, include: { lead: true } });
  if (!reply) return { ok: false, error: "udkastet findes ikke" };
  if (reply.status !== "draft") return { ok: false, error: `udkastet er allerede ${reply.status}` };
  if (!reply.lead.email) return { ok: false, error: "leadet har ingen e-mail, ring i stedet" };

  const sent = await sendEmail({ to: reply.lead.email, subject: reply.subject, text: reply.body });
  if (!sent.ok) return { ok: false, error: sent.error || "afsendelse fejlede" };

  await prisma.$transaction([
    prisma.leadReply.update({
      where: { id: replyId },
      data: { status: "sent", sentAt: new Date(), approvedBy: slackUser },
    }),
    prisma.lead.update({ where: { id: reply.leadId }, data: { status: "contacted" } }),
  ]);

  if (reply.slackChannel && reply.slackTs) {
    const ctx = leadContextFrom(reply.lead);
    await updateMessage(reply.slackChannel, reply.slackTs, `Sendt til ${reply.lead.email}`, [
      { type: "header", text: { type: "plain_text", text: `Sendt: ${ctx.name}`.slice(0, 150) } },
      { type: "section", text: { type: "mrkdwn",
        text: `Godkendt af <@${slackUser}> og sendt til *${reply.lead.email}*${sent.simulated ? " _(dry-run, intet blev sendt)_" : ""}.` } },
      { type: "section", text: { type: "mrkdwn", text: `*Emne:* ${reply.subject}\n\n${quote(reply.body)}`.slice(0, 2900) } },
    ]);
  }
  return { ok: true };
}

/** Afvist med feedback: skriv en ny version og laeg den op til godkendelse igen. */
export async function reviseReply(replyId: number, feedback: string, slackUser: string): Promise<{ ok: boolean; error?: string }> {
  const reply = await prisma.leadReply.findUnique({ where: { id: replyId }, include: { lead: true } });
  if (!reply) return { ok: false, error: "udkastet findes ikke" };
  if (reply.status !== "draft") return { ok: false, error: `udkastet er allerede ${reply.status}` };

  const ctx = leadContextFrom(reply.lead);
  const draft = await draftReply(ctx, { subject: reply.subject, body: reply.body, feedback });

  const next = await prisma.$transaction(async (tx) => {
    await tx.leadReply.update({ where: { id: replyId }, data: { status: "replaced", feedback } });
    return tx.leadReply.create({
      data: {
        leadId: reply.leadId, version: reply.version + 1, subject: draft.subject, body: draft.body,
        status: "draft", model: draft.model,
        slackChannel: reply.slackChannel, slackTs: reply.slackTs,
      },
    });
  });

  if (reply.slackChannel && reply.slackTs) {
    await updateMessage(reply.slackChannel, reply.slackTs, `Nyt udkast v${next.version}: ${ctx.name}`, [
      ...draftBlocks(ctx, next),
      { type: "context", elements: [{ type: "mrkdwn", text: `v${reply.version} afvist af <@${slackUser}>: _${feedback.slice(0, 300)}_` }] },
    ]);
  }
  return { ok: true };
}
