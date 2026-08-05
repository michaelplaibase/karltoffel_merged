// Server-side helper: build the default quote ("tilbud") draft (recipient,
// subject, body) from a Contact (+ optional Order) and the Company, using the
// editable "tilbud" template (stored overrides fall back to the TEMPLATES
// default). Server-only — pulls the template overrides from the settings store.
import { getTemplateValues } from "@/lib/settings-store";
import { TEMPLATES } from "@/lib/templates-config";
import {
  buildQuoteVars, renderTemplate,
  type QuoteContact, type QuoteOrderLike, type QuoteTask, type QuoteCompany,
} from "@/lib/quote-render";
import { renderQuoteHtml } from "@/lib/quote-html";
import { erPakkeYdelse, linjeAar, type PricedService } from "@/lib/tilbudsmotor-pricing";

export type QuoteDraft = { to: string; subject: string; body: string; html?: string };

type LeadLike = { name: string; email: string | null; address: string | null; payload: string | null };

function krFmt(n: number): string {
  return n.toLocaleString("da-DK") + " kr";
}

/** Only these 4 pricing-page package names get a "Pakke: {navn}" heading in
 *  the e-mail (Michael, confirmed 2026-08-05: "kun de 4"). Any other
 *  pakke-cookie value (Sæsonpakken, Sommerhuspakken, ...) falls through to
 *  renderQuoteHtml's own default. Package/extra grouping itself always comes
 *  from erPakkeYdelse(id) — the actual Villapakken 8 items — not this name. */
const NAMED_PACKAGES = new Set(["Villapakken", "All Inclusive", "Erhvervspakken", "Bland Selv"]);

/** Plain-text mirror of renderQuoteHtml's grouping, for the `opgave_liste`
 *  template token used by the text-only body. */
function opgaveListeText(services: PricedService[], pakkeNavn: string | null): string {
  const line = (s: PricedService, i: number) => `${i + 1}. ${s.navn}${s.qty && s.enhed ? ` — ${s.qty} ${s.enhed}` : ""} — ${krFmt(Math.round(linjeAar(s)))}`;
  const pakke = services.filter((s) => erPakkeYdelse(s.id));
  const ekstra = services.filter((s) => !erPakkeYdelse(s.id));
  if (!pakke.length) return services.map(line).join("\n");
  const parts: string[] = [`Pakke: ${pakkeNavn ?? "Villapakken"}`, pakke.map(line).join("\n")];
  if (ekstra.length) parts.push("", "Ekstra ydelser til ekstra heldige karltofler:", ekstra.map(line).join("\n"));
  return parts.join("\n");
}

/** Same "one free-text address -> street + city on the first comma" split used
 *  by the lead-to-contact conversion (app/actions/leads.ts). */
function splitLeadAddress(addr: string): { street: string; city: string } {
  const i = addr.indexOf(",");
  if (i === -1) return { street: addr.trim(), city: "" };
  return { street: addr.slice(0, i).trim(), city: addr.slice(i + 1).trim() };
}

/** Build a tilbud draft straight from a Lead (tilbudsmotoren payload), before it
 *  has been converted to a Contact. Used by Karl's lead-quote loop: draft ->
 *  Slack approval -> send (see karl_cs/LEAD_QUOTE_PLAYBOOK.md). */
export async function buildLeadQuoteDraft(lead: LeadLike, company: QuoteCompany): Promise<QuoteDraft> {
  const { street, city } = splitLeadAddress(lead.address ?? "");
  let isCompany = false;
  let services: PricedService[] = [];
  let pakkeNavn: string | null = null;
  if (lead.payload) {
    try {
      const p = JSON.parse(lead.payload) as { kundetype?: string; services?: Partial<PricedService>[]; pakke?: string };
      isCompany = p.kundetype === "erhverv";
      services = (p.services ?? []).filter(
        (s): s is PricedService => !!s && typeof s.id === "string" && typeof s.navn === "string" && s.navn.trim().length > 0,
      );
      const rawPakke = p.pakke?.trim() || null;
      pakkeNavn = rawPakke && NAMED_PACKAGES.has(rawPakke) ? rawPakke : null;
    } catch { /* corrupt payload -> text-only quote */ }
  }

  const tasks: QuoteTask[] = services.map((s) => ({
    description: `${s.navn}${s.qty && s.enhed ? ` — ${s.qty} ${s.enhed}` : ""}`,
    price: s.pris != null ? Math.max(0, Math.round(linjeAar(s))) : 0,
  }));

  const contact: QuoteContact = { name: lead.name, att: null, isCompany, email: lead.email, street, city };
  const orderLike: QuoteOrderLike = tasks.length
    ? { deliveryAddress: lead.address || [street, city].filter(Boolean).join(", "), tasks }
    : null;

  const tpl = TEMPLATES.find((t) => t.key === "tilbud");
  const values = await getTemplateValues("tilbud");
  const vars = buildQuoteVars(contact, orderLike, company);
  if (services.length) vars.opgave_liste = opgaveListeText(services, pakkeNavn);
  const subjectTpl = values.subjects?.[0] ?? tpl?.subjects[0]?.val ?? "";
  const bodyTpl = values.body ?? tpl?.body ?? "";
  const total = tasks.reduce((a, t) => a + t.price, 0);
  const html = services.length
    ? renderQuoteHtml({
        fornavn: vars.kunde_fornavn,
        adresse: vars.leverings_adresse,
        services,
        total,
        gyldigTil: vars.tilbud_gyldig_til,
        pakkeNavn: pakkeNavn ?? undefined,
        firma: { navn: company.name, telefon: company.phone, email: company.email },
      })
    : undefined;
  return {
    to: lead.email ?? "",
    subject: renderTemplate(subjectTpl, vars),
    body: renderTemplate(bodyTpl, vars),
    html,
  };
}

export async function buildQuoteDraft(
  contact: QuoteContact,
  order: QuoteOrderLike,
  company: QuoteCompany,
): Promise<QuoteDraft> {
  const tpl = TEMPLATES.find((t) => t.key === "tilbud");
  const values = await getTemplateValues("tilbud");
  const vars = buildQuoteVars(contact, order, company);
  const subjectTpl = values.subjects?.[0] ?? tpl?.subjects[0]?.val ?? "";
  const bodyTpl = values.body ?? tpl?.body ?? "";
  return {
    to: contact.email ?? "",
    subject: renderTemplate(subjectTpl, vars),
    body: renderTemplate(bodyTpl, vars),
  };
}
