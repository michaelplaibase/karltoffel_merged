// Server-side helper: build the default quote ("tilbud") draft (recipient,
// subject, body) from a Contact (+ optional Order) and the Company, using the
// editable "tilbud" template (stored overrides fall back to the TEMPLATES
// default). Server-only — pulls the template overrides from the settings store.
import { getTemplateValues } from "@/lib/settings-store";
import { TEMPLATES } from "@/lib/templates-config";
import {
  buildQuoteVars, renderTemplate,
  type QuoteContact, type QuoteOrderLike, type QuoteCompany,
} from "@/lib/quote-render";

export type QuoteDraft = { to: string; subject: string; body: string };

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
