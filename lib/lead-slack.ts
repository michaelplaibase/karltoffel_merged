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

/** Kundens egen tekst (navn, adresse, besked) gaar ind i en Slack-kodeblok.
 *  Skriver kunden selv tre backticks, ville de lukke blokken og resten af
 *  teksten blive tolket som mrkdwn, saa den kunne forfalske knapper eller
 *  efterligne systemtekst. Backticks neutraliseres derfor. */
function sikkerBlok(s: string): string {
  return s.replace(/`/g, "'");
}

function draftBlocks(ctx: LeadContext, reply: { id: number; version: number; subject: string; body: string }): unknown[] {
  const mention = approverMention();
  return [
    { type: "header", text: { type: "plain_text", text: `Nyt lead: ${ctx.name}`.slice(0, 150) } },
    { type: "section", text: { type: "mrkdwn", text: "```" + sikkerBlok(leadSummary(ctx)) + "```" } },
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

/** Frigiv en reservation igen, saa knappen kan proeves paa ny. */
async function frigiv(replyId: number): Promise<void> {
  await prisma.leadReply.updateMany({ where: { id: replyId, status: "sending" }, data: { status: "draft" } });
}

/** Godkendt: send mailen til kunden og laas beskeden.
 *
 *  Reserverer raekken ATOMISK foer der sendes noget. Uden det kunne to samtidige
 *  kald (et dobbeltklik, eller Slack der proever igen fordi svaret var for
 *  langsomt) begge passere et status-tjek og sende den samme mail til kunden to
 *  gange. updateMany med status i where er betingelsen og skrivningen i ét
 *  atomisk trin: praecis én kalder faar count === 1, resten bliver afvist. */
export async function approveReply(replyId: number, slackUser: string): Promise<{ ok: boolean; error?: string }> {
  const claim = await prisma.leadReply.updateMany({
    where: { id: replyId, status: "draft" },
    data: { status: "sending", approvedBy: slackUser },
  });
  if (claim.count !== 1) return { ok: false, error: "udkastet er allerede behandlet" };

  const reply = await prisma.leadReply.findUnique({ where: { id: replyId }, include: { lead: true } });
  if (!reply) return { ok: false, error: "udkastet findes ikke" };
  if (!reply.lead.email) {
    await frigiv(replyId);
    return { ok: false, error: "leadet har ingen e-mail, ring i stedet" };
  }

  const sent = await sendEmail({ to: reply.lead.email, subject: reply.subject, text: reply.body });
  if (!sent.ok) {
    await frigiv(replyId);
    return { ok: false, error: sent.error || "afsendelse fejlede" };
  }

  // Mailen ER ude nu. Fejler skrivningen her, bliver raekken staaende som
  // "sending", hvilket er den sikre ende at fejle i: knappen re-armes ikke, saa
  // kunden kan ikke faa mailen to gange. Det kraever i stedet et manuelt kig.
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
  // Samme atomiske reservation som ved godkendelse: to samtidige modal-
  // indsendelser maa ikke give to sideloebende v2-udkast, som begge kunne
  // godkendes og dermed sende to mails.
  const claim = await prisma.leadReply.updateMany({
    where: { id: replyId, status: "draft" },
    data: { status: "replaced", feedback },
  });
  if (claim.count !== 1) return { ok: false, error: "udkastet er allerede behandlet" };

  const reply = await prisma.leadReply.findUnique({ where: { id: replyId }, include: { lead: true } });
  if (!reply) return { ok: false, error: "udkastet findes ikke" };

  const ctx = leadContextFrom(reply.lead);
  const draft = await draftReply(ctx, { subject: reply.subject, body: reply.body, feedback });

  const next = await prisma.leadReply.create({
    data: {
      leadId: reply.leadId, version: reply.version + 1, subject: draft.subject, body: draft.body,
      status: "draft", model: draft.model,
      slackChannel: reply.slackChannel, slackTs: reply.slackTs,
    },
  });

  if (reply.slackChannel && reply.slackTs) {
    const blocks = [
      ...draftBlocks(ctx, next),
      { type: "context", elements: [{ type: "mrkdwn", text: `v${reply.version} afvist af <@${slackUser}>: _${feedback.slice(0, 300)}_` }] },
    ];
    const opdateret = await updateMessage(reply.slackChannel, reply.slackTs, `Nyt udkast v${next.version}: ${ctx.name}`, blocks);
    // Fejler opdateringen, staar den gamle besked tilbage med knapper der peger
    // paa et udkast der nu er afloest, og floejet ville laase. Slaa i stedet det
    // nye udkast op som en frisk besked, saa der altid er noget at godkende.
    if (!opdateret.ok) {
      const nyBesked = await postMessage(`Nyt udkast v${next.version}: ${ctx.name}`, blocks);
      if (nyBesked.ts) {
        await prisma.leadReply.update({
          where: { id: next.id },
          data: { slackTs: nyBesked.ts, slackChannel: nyBesked.channel ?? leadsChannel() },
        });
      }
    }
  }
  return { ok: true };
}
