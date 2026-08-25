import { prisma } from "@/lib/db";
import { verifySlackRequest, openView, updateMessage, respond } from "@/lib/slack";
import {
  ACTION_EDIT, ACTION_APPROVE, CALLBACK_EDIT,
  buildEditModal, buildLeadBlocks, leadFallbackText, applyEditedQuantities, crmUrl,
} from "@/lib/slack-lead";
import { parseLeadPayload, serializeLeadPayload, beregn, medRabatkode, kr } from "@/lib/tilbudsmotor-pricing";
import { renderQuoteHtml, renderQuoteText } from "@/lib/quote-html";
import { sendEmail } from "@/lib/email";
import { issueQuoteToken } from "@/lib/quote-tokens";
import { underLimit, recordHit } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

// Slacks interaktivitets-endpoint: knapklik og dialog-indsendelser fra #leads.
// Sæt URL'en her i din Slack-app under Interactivity & Shortcuts:
//   https://crm.karltoffel.dk/api/slack/interactions
//
// SIKKERHED — dette endpoint kan sende et tilbud til en kunde, så det er den
// mest følsomme rute i CRM'et:
//   • Middleware fritager /api for session-cookien, så autentificering sker
//     UDELUKKENDE via Slacks HMAC-signatur over den RÅ body.
//   • Fejler LUKKET: uden SLACK_SIGNING_SECRET svares 503, aldrig "luk igennem".
//   • Tidsstempel ældre end 5 min afvises (replay-værn, se lib/slack.ts).
//   • Priser læses ALDRIG fra Slack-payloadet. Serveren henter leadet forfra og
//     regner selv, så en forfalsket knapværdi højst kan pege på et andet lead —
//     aldrig diktere et beløb.
//
// SVARTID: Slack forventer svar inden 3 sekunder, ellers viser den en fejl til
// Kristian. Derfor åbnes dialogen som det FØRSTE, og tungt arbejde (mail) sker
// efter at beskeden er kvitteret.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
/** Tomt 200-svar: Slack lukker dialogen og gør ellers ingenting. */
const ack = () => new Response("", { status: 200 });

/** Fejl vist KUN til den der klikkede (ephemeral), så kanalen ikke fyldes med
 *  fejl kunden aldrig skulle se. */
async function ephemeral(responseUrl: string | undefined, text: string): Promise<Response> {
  if (responseUrl) await respond(responseUrl, { text, response_type: "ephemeral" });
  return ack();
}

type SlackUser = { id?: string; name?: string; username?: string };
type Payload = {
  type?: string;
  trigger_id?: string;
  response_url?: string;
  user?: SlackUser;
  channel?: { id?: string };
  message?: { ts?: string };
  actions?: { action_id?: string; value?: string }[];
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: { values?: Record<string, Record<string, { value?: string | null }>> };
  };
};

/** private_metadata bærer "leadId:channel:ts", så en dialog-indsendelse kan
 *  opdatere netop den besked knappen blev trykket på. */
function packMeta(leadId: number, channel: string | undefined, ts: string | undefined): string {
  return [leadId, channel ?? "", ts ?? ""].join(":");
}
function unpackMeta(meta: string | undefined): { leadId: number; channel: string; ts: string } {
  const [id = "", channel = "", ts = ""] = (meta ?? "").split(":");
  return { leadId: Number(id), channel, ts };
}

async function loadLead(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.lead.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, address: true, message: true, payload: true, status: true },
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!underLimit(`slack:interact:${ip}`, 60)) return json({ error: "Too many requests" }, 429);

  // Den rå tekst SKAL læses før alt andet — signaturen er beregnet over de
  // præcise bytes, så en parse-og-serialisér-igen ville bryde den.
  const raw = await req.text();

  const verdict = await verifySlackRequest(req.headers, raw);
  if (verdict === "unconfigured") {
    console.error("[slack] SLACK_SIGNING_SECRET mangler — interaktioner afvises");
    return json({ error: "Slack interactions not configured" }, 503);
  }
  if (verdict !== "ok") {
    recordHit(`slack:interact:${ip}`, 60_000);
    console.error(`[slack] afvist interaktion fra ${ip}: ${verdict}`);
    return json({ error: "Invalid signature" }, 401);
  }

  // Slack sender application/x-www-form-urlencoded med ét felt: payload=<json>.
  let p: Payload;
  try {
    const form = new URLSearchParams(raw);
    p = JSON.parse(form.get("payload") ?? "{}") as Payload;
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  if (p.type === "block_actions") return handleAction(p);
  if (p.type === "view_submission") return handleSubmission(p);
  return ack();   // url_verification m.m. — intet at gøre
}

// ---------------------------------------------------------------------------
// Knapklik
// ---------------------------------------------------------------------------

async function handleAction(p: Payload): Promise<Response> {
  const action = p.actions?.[0];
  const id = Number(action?.value);

  if (action?.action_id === ACTION_EDIT) {
    // trigger_id er gyldigt i 3 sekunder — dialogen åbnes som det første.
    const lead = await loadLead(id);
    if (!lead) return ephemeral(p.response_url, "Kunne ikke finde leadet — er det slettet?");
    if (!p.trigger_id) return ephemeral(p.response_url, "Slack sendte intet trigger_id, prøv at klikke igen.");

    const payload = parseLeadPayload(lead.payload);
    if (payload.tilbudSendtAt) {
      return ephemeral(p.response_url, `Tilbuddet er allerede sendt (${payload.tilbudSendtAt.slice(0, 16).replace("T", " ")}). Ret det i CRM'et: ${crmUrl("/leads")}`);
    }

    const view = buildEditModal(lead, payload) as Record<string, unknown>;
    view.private_metadata = packMeta(lead.id, p.channel?.id, p.message?.ts);
    const res = await openView(p.trigger_id, view);
    if (!res.ok) {
      console.error(`[slack] views.open fejlede for lead ${lead.id}: ${res.error}`);
      return ephemeral(p.response_url, "Kunne ikke åbne rette-dialogen. Prøv igen.");
    }
    return ack();
  }

  if (action?.action_id === ACTION_APPROVE) {
    const lead = await loadLead(id);
    if (!lead) return ephemeral(p.response_url, "Kunne ikke finde leadet — er det slettet?");
    const who = p.user?.username || p.user?.name || "ukendt";
    return sendQuote(lead, { channel: p.channel?.id, ts: p.message?.ts, responseUrl: p.response_url, who });
  }

  return ack();   // "Åbn i CRM" er et rent url-link — intet at behandle
}

// ---------------------------------------------------------------------------
// Dialog-indsendelse: gem rettede mængder og genberegn
// ---------------------------------------------------------------------------

async function handleSubmission(p: Payload): Promise<Response> {
  if (p.view?.callback_id !== CALLBACK_EDIT) return ack();

  const { leadId, channel, ts } = unpackMeta(p.view.private_metadata);
  const lead = await loadLead(leadId);
  if (!lead) {
    // response_action:errors viser fejlen inde i dialogen i stedet for at lukke den.
    return json({
      response_action: "errors",
      errors: { [`qty_ukendt`]: "Leadet findes ikke længere." },
    });
  }

  const payload = parseLeadPayload(lead.payload);
  if (payload.tilbudSendtAt) {
    return json({ response_action: "clear" });
  }

  const { services, ændringer } = applyEditedQuantities(payload.services, p.view.state?.values ?? {});
  const opdateret = { ...payload, services };

  // CAS på payload-strengen: et blindt update kunne viske et samtidigt sat
  // tilbudSendtAt-claim (dublet-tilbudsmail) eller en kollegas rettelser ud.
  const cas = await prisma.lead.updateMany({
    where: { id: lead.id, payload: lead.payload },
    data: { payload: serializeLeadPayload(opdateret) },
  });
  if (cas.count === 0) {
    return json({
      response_action: "errors",
      errors: { [`qty_ukendt`]: "Leadet blev lige ændret af en anden — luk og åbn dialogen igen." },
    });
  }

  const r = beregn(services);
  const { aarNet } = medRabatkode(r, opdateret.rabatOk && opdateret.rabatPct ? opdateret.rabatPct : 0);

  // Opdatér den oprindelige besked, så kortet viser de nye tal og knapperne
  // stadig virker. Fejler det (fx besked for gammel), postes intet nyt — tallene
  // ligger gemt, og Kristian kan se dem i CRM'et.
  if (channel && ts) {
    const blocks = buildLeadBlocks(lead, opdateret, {
      advarsel: ændringer.length
        ? `Mængder rettet: ${ændringer.join(" · ")} → nyt estimat ${kr(aarNet)}/år`
        : undefined,
    });
    const res = await updateMessage({ channel, ts, text: leadFallbackText(lead, opdateret), blocks });
    if (!res.ok) console.error(`[slack] chat.update fejlede for lead ${lead.id}: ${res.error}`);
  }

  return json({ response_action: "clear" });
}

// ---------------------------------------------------------------------------
// Send tilbuddet
// ---------------------------------------------------------------------------

type LeadRow = NonNullable<Awaited<ReturnType<typeof loadLead>>>;

async function sendQuote(
  lead: LeadRow,
  ctx: { channel?: string; ts?: string; responseUrl?: string; who: string },
): Promise<Response> {
  if (!lead.email) {
    return ephemeral(ctx.responseUrl, `${lead.name} har ingen e-mail på leadet, så tilbuddet kan ikke sendes. Tilføj den i CRM'et: ${crmUrl("/leads")}`);
  }

  const payload = parseLeadPayload(lead.payload);
  if (payload.tilbudSendtAt) {
    return ephemeral(ctx.responseUrl, `Tilbuddet er allerede sendt ${payload.tilbudSendtAt.slice(0, 16).replace("T", " ")} — sender ikke igen.`);
  }
  if (!payload.services.length) {
    return ephemeral(ctx.responseUrl, "Leadet har ingen valgte ydelser, så der er intet tilbud at sende.");
  }

  const company = await prisma.company.findFirst();
  if (!company) return ephemeral(ctx.responseUrl, "Ingen firmaoplysninger i CRM'et — kan ikke sende tilbud.");

  // Markér som sendt FØR afsendelsen — ATOMISK: updateMany med den præcise
  // gamle payload-streng i where er et compare-and-swap (samme princip som
  // consumeQuoteToken), så to næsten samtidige klik ikke begge kan passere et
  // læs-så-skriv-vindue og sende hver sin mail. Kun requesten med count===1
  // vandt claimet og må sende. Fejler mailen bagefter, ryddes markeringen igen
  // nedenfor, så Kristian kan prøve om.
  const sendtAt = new Date().toISOString();
  const claimed = await prisma.lead.updateMany({
    where: { id: lead.id, payload: lead.payload },
    data: { payload: serializeLeadPayload({ ...payload, tilbudSendtAt: sendtAt }) },
  });
  if (claimed.count === 0) {
    // Payloadet er ændret siden vores læsning: et samtidigt klik claimede
    // afsendelsen (eller mængderne blev lige rettet) — send ikke en dublet.
    return ephemeral(ctx.responseUrl, "Tilbuddet er allerede ved at blive sendt (eller leadet blev lige rettet) — sender ikke igen.");
  }

  const r = beregn(payload.services);
  const { aarNet } = medRabatkode(r, payload.rabatOk && payload.rabatPct ? payload.rabatPct : 0);

  const gyldigDage = 30;
  const until = new Date(Date.now() + gyldigDage * 86_400_000);
  const gyldigTil = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(until);

  // Ja/Måske/Nej-links: engangs-token (lib/quote-tokens.ts) + app/api/quote-response
  // håndterer klikket uden login. Falder tilbage til en mailto, hvis basis-URL'en
  // ikke er sat — en død knap i en kundemail er værre end ingen knap.
  const responseBase = (process.env.QUOTE_BASE_URL?.trim() || process.env.CRM_BASE_URL?.trim() || "https://crm.karltoffel.dk").replace(/\/$/, "");
  const token = await issueQuoteToken(lead.id);
  const responseUrls = {
    accept: `${responseBase}/api/quote-response?t=${token}&c=accept`,
    maybe: `${responseBase}/api/quote-response?t=${token}&c=maybe`,
    decline: `${responseBase}/api/quote-response?t=${token}&c=decline`,
  };
  const acceptUrl = company.email
    ? `mailto:${company.email}?subject=${encodeURIComponent(`Jeg accepterer tilbuddet — ${lead.name}`)}`
    : undefined;

  // Rabatlinjerne SKAL med, når totalen er lavere end summen af linjerne — ellers
  // kan kunden lægge linjepriserne sammen og få et andet tal end totalen.
  // Rækkefølgen matcher beregningen: mængderabat først, rabatkode oven på.
  const kodePct = payload.rabatOk && payload.rabatPct ? payload.rabatPct : 0;
  const rabatter = [
    ...(r.rabatPct ? [{ label: `Mængderabat (−${r.rabatPct} %)`, beloeb: r.rabatKr }] : []),
    ...(kodePct ? [{ label: `Rabatkode ${payload.rabatkode ?? ""} (−${kodePct} %)`.trim(), beloeb: r.aar - aarNet }] : []),
  ];

  const input = {
    fornavn: lead.name.trim().split(/\s+/)[0] || lead.name,
    adresse: lead.address || "din adresse",
    services: payload.services,
    total: aarNet,
    rabatter,
    gyldigTil,
    acceptUrl,
    responseUrls,
    firma: { navn: company.name, telefon: company.phone, email: company.email },
  };

  const sent = await sendEmail({
    to: lead.email,
    subject: `Dit tilbud fra ${company.name}`,
    text: renderQuoteText(input),
    html: renderQuoteHtml(input),
  });

  if (!sent.ok) {
    // Rul markeringen tilbage, så knappen kan bruges igen.
    await prisma.lead.update({
      where: { id: lead.id },
      data: { payload: serializeLeadPayload({ ...payload, tilbudSendtAt: null }) },
    });
    console.error(`[slack] tilbudsmail fejlede for lead ${lead.id}: ${sent.error}`);
    return ephemeral(ctx.responseUrl, `Tilbuddet blev IKKE sendt: ${sent.error ?? "ukendt fejl"}. Markeringen er rullet tilbage — prøv igen.`);
  }

  // Leadet er kontaktet nu. Bevidst ikke "converted": kunden har fået tilbuddet,
  // men har ikke accepteret endnu, og daily_overview i lib/mcp-tools.ts regner
  // netop "contacted" som et åbent tilbud der kan blive gammelt.
  if (lead.status === "new") {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "contacted" } });
  }

  // Fjern knapperne på kortet, så det samme tilbud ikke kan sendes igen.
  if (ctx.channel && ctx.ts) {
    const låst = sent.simulated
      ? `Tilbud på ${kr(aarNet)}/år klargjort af ${ctx.who} — DRY-RUN, intet sendt (RESEND_API_KEY/EMAIL_FROM mangler).`
      : `Tilbud på ${kr(aarNet)}/år sendt til ${lead.email} af ${ctx.who}.`;
    const res = await updateMessage({
      channel: ctx.channel, ts: ctx.ts,
      text: leadFallbackText(lead, payload),
      blocks: buildLeadBlocks(lead, payload, { låst }),
    });
    if (!res.ok) console.error(`[slack] chat.update efter afsendelse fejlede for lead ${lead.id}: ${res.error}`);
  }

  return ack();
}
