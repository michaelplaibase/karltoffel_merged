// Block Kit-opbygningen for lead-flowet i #leads. Ren funktion — ingen DB,
// ingen fetch — så både lead-indtaget og interaktions-handleren kan bygge de
// samme blokke, og de kan unit-testes uden Slack.
//
// Flowet Kristian kører:
//   1. Lead lander → besked i #leads (denne fils buildLeadBlocks)
//   2. Google-event minder ham om at ringe → han får de rigtige mål
//   3. "Ret mængder" → dialog med et talfelt pr. ydelse (buildEditModal)
//   4. "Godkend og send" → tilbudsmailen ryger direkte til kunden
//
// Knapperne bærer lead-id'et i `value`, og dialogen bærer det i
// private_metadata. Der ligger ingen priser i klientens payload: serveren
// henter altid leadet forfra og regner selv, så et manipuleret payload ikke kan
// diktere hvad kunden får tilsendt.

import { beregn, kr, linjeAar, erPakkeYdelse, medRabatkode, type LeadPayload, type PricedService } from "@/lib/tilbudsmotor-pricing";

export const ACTION_EDIT = "lead_edit_qty";
export const ACTION_APPROVE = "lead_approve_quote";
export const CALLBACK_EDIT = "lead_edit_submit";
/** block_id-præfiks i dialogen; resten er service-id'et. */
export const QTY_BLOCK_PREFIX = "qty_";

const DKK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

export function crmUrl(path = "/leads"): string {
  const base = process.env.CRM_BASE_URL?.trim().replace(/\/$/, "") || "https://crm.karltoffel.dk";
  return base + path;
}

/** Slack mrkdwn escaping: kun &, < og > har særlig betydning. Vi rører IKKE
 *  * og _, så en kunde der skriver "5*5 m" ikke får teksten forvansket. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type LeadLike = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  message: string | null;
};

function ydelseLinje(s: PricedService): string {
  const beloeb = s.pris == null
    ? (erPakkeYdelse(s.id) ? "_indeholdt_" : "_pris ved besøg_")
    : `${kr(linjeAar(s))}/år`;
  const maengde = s.qty ? `${DKK.format(s.qty)}${s.enhed ? " " + s.enhed : ""}` : "";
  const freq = s.freq > 1 ? ` × ${s.freq}/år` : "";
  return `• ${esc(s.navn)}${maengde ? ` — ${esc(maengde)}${freq}` : ""} · ${beloeb}`;
}

/** Beskeden i #leads. `advarsel` bruges til at markere et dedup-merge, hvor
 *  leadet er en opfølgning på et emne Kristian allerede har set. */
export function buildLeadBlocks(
  lead: LeadLike,
  p: LeadPayload,
  opts: { advarsel?: string; låst?: string } = {},
): unknown[] {
  const r = beregn(p.services);
  const kodePct = p.rabatOk && p.rabatPct ? p.rabatPct : 0;
  const { aarNet } = medRabatkode(r, kodePct);

  const pakke = p.services.filter((s) => erPakkeYdelse(s.id));
  const ekstra = p.services.filter((s) => !erPakkeYdelse(s.id));

  const kontakt = [
    lead.phone ? `☎️ <tel:${esc(lead.phone)}|${esc(lead.phone)}>` : null,
    lead.email ? `✉️ <mailto:${esc(lead.email)}|${esc(lead.email)}>` : null,
  ].filter(Boolean).join("   ");

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Nyt lead: ${lead.name}`.slice(0, 150), emoji: true },
    },
  ];

  if (opts.advarsel) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `⚠️ ${esc(opts.advarsel)}` }] });
  }

  const fakta = [
    lead.address ? `*Adresse*\n${esc(lead.address)}` : null,
    p.kundetype ? `*Kundetype*\n${p.kundetype === "erhverv" ? "🏢 Erhverv" : "🏡 Privat"}` : null,
    `*Estimat*\n${kr(aarNet)}/år · ${kr(aarNet / 12)}/md`,
    r.visits ? `*Besøg*\n${r.visits}/år` : null,
  ].filter((f): f is string => f !== null);

  blocks.push({ type: "section", fields: fakta.map((text) => ({ type: "mrkdwn", text })) });

  if (kontakt) blocks.push({ type: "section", text: { type: "mrkdwn", text: kontakt } });

  if (pakke.length) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Villapakken*\n${pakke.map(ydelseLinje).join("\n")}`.slice(0, 3000) } });
  }
  if (ekstra.length) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Tilvalg*\n${ekstra.map(ydelseLinje).join("\n")}`.slice(0, 3000) } });
  }

  const noter = [
    r.rabatPct ? `Mængderabat −${r.rabatPct}%` : null,
    kodePct ? `Rabatkode ${esc(p.rabatkode ?? "")} −${kodePct}%` : null,
    p.rabatkode && !p.rabatOk ? `Ugyldig rabatkode: ${esc(p.rabatkode)}` : null,
  ].filter(Boolean).join(" · ");
  if (noter) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: noter }] });

  if (lead.message) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Kundens besked*\n>${esc(lead.message).slice(0, 900).replace(/\n/g, "\n>")}` } });
  }

  // Låst = tilbuddet er sendt. Knapperne fjernes helt, så det samme tilbud ikke
  // kan sendes to gange med to forskellige tal.
  if (opts.låst) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `✅ ${esc(opts.låst)}` }] });
  } else {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button", action_id: ACTION_EDIT, value: String(lead.id),
          text: { type: "plain_text", text: "✏️ Ret mængder", emoji: true },
        },
        {
          type: "button", action_id: ACTION_APPROVE, value: String(lead.id), style: "primary",
          text: { type: "plain_text", text: "✅ Godkend og send", emoji: true },
          // Sender straks til kunden, så bekræftelsen er det sidste værn mod et
          // fejlklik på mobilen.
          confirm: {
            title: { type: "plain_text", text: "Send tilbud?" },
            text: { type: "mrkdwn", text: `Tilbuddet på *${kr(aarNet)}/år* sendes til ${lead.email ? `*${esc(lead.email)}*` : "kunden"} med det samme.` },
            confirm: { type: "plain_text", text: "Send nu" },
            deny: { type: "plain_text", text: "Annullér" },
          },
        },
        {
          type: "button", action_id: "lead_open_crm", url: crmUrl("/leads"),
          text: { type: "plain_text", text: "Åbn i CRM", emoji: true },
        },
      ],
    });
  }

  return blocks;
}

/** Notifikations-fallback. Slack viser den i push og på låseskærmen, så den skal
 *  kunne stå alene. */
export function leadFallbackText(lead: LeadLike, p: LeadPayload): string {
  const r = beregn(p.services);
  const { aarNet } = medRabatkode(r, p.rabatOk && p.rabatPct ? p.rabatPct : 0);
  return `Nyt lead: ${lead.name}${lead.address ? ` — ${lead.address}` : ""} · ${kr(aarNet)}/år`;
}

/** Rette-dialogen: ét talfelt pr. prissat ydelse. Uprisede linjer
 *  ("indeholdt" / "pris ved besøg") får ingen felt — en mængde ville alligevel
 *  ikke flytte prisen, og et felt uden virkning inviterer til misforståelser.
 *
 *  Dialogen viser aldrig en pris pr. felt: Kristian retter mængden, serveren
 *  regner. Det er samme grund til at prisen ikke sendes med i payloadet. */
export function buildEditModal(lead: LeadLike, p: LeadPayload): unknown {
  const redigerbare = p.services.filter((s) => s.pris != null);
  const r = beregn(p.services);
  const { aarNet } = medRabatkode(r, p.rabatOk && p.rabatPct ? p.rabatPct : 0);

  const blocks: unknown[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${esc(lead.name)}*${lead.address ? `\n${esc(lead.address)}` : ""}\nNuværende estimat: *${kr(aarNet)}/år*` },
    },
    { type: "divider" },
  ];

  if (!redigerbare.length) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "Der er ingen prissatte ydelser på dette lead, så der er ingen mængder at rette." },
    });
  }

  for (const s of redigerbare) {
    blocks.push({
      type: "input",
      block_id: QTY_BLOCK_PREFIX + s.id,
      label: { type: "plain_text", text: s.navn.slice(0, 150) },
      hint: { type: "plain_text", text: `${s.enhed || "stk"} · ${s.freq}× om året · ${kr(s.pris ?? 0)} pr. ${s.enhed || "stk"}`.slice(0, 150) },
      element: {
        type: "number_input",
        action_id: "qty",
        is_decimal_allowed: true,
        min_value: "0",
        initial_value: String(s.qty),
      },
      optional: true,   // tomt felt = behold nuværende mængde
    });
  }

  return {
    type: "modal",
    callback_id: CALLBACK_EDIT,
    private_metadata: String(lead.id),
    title: { type: "plain_text", text: "Ret mængder" },
    submit: { type: "plain_text", text: "Gem og genberegn" },
    close: { type: "plain_text", text: "Annullér" },
    blocks,
  };
}

/** Læs de indsendte mængder ud af view.state.values og læg dem oven på
 *  services. Tomt/ugyldigt felt = mængden røres ikke. */
export function applyEditedQuantities(
  services: PricedService[],
  values: Record<string, Record<string, { value?: string | null }>>,
): { services: PricedService[]; ændringer: string[] } {
  const ændringer: string[] = [];
  const opdateret = services.map((s) => {
    const block = values[QTY_BLOCK_PREFIX + s.id];
    const raw = block?.qty?.value;
    if (raw == null || raw === "") return s;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return s;
    const ny = Math.min(n, 100_000);   // samme loft som lead-indtaget
    if (ny === s.qty) return s;
    ændringer.push(`${s.navn}: ${DKK.format(s.qty)} → ${DKK.format(ny)} ${s.enhed}`.trim());
    return { ...s, qty: ny };
  });
  return { services: opdateret, ændringer };
}
