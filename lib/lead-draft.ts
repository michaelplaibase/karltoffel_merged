// AI-udkast til svarmailen paa et indkommet lead. Udkastet sendes ALDRIG af sig
// selv: det skal godkendes af et menneske i Slack foerst (se app/api/slack/
// interactive). Ren REST + fetch mod Anthropic, intet SDK (samme moenster som
// lib/email.ts og lib/gcal.ts).
//
// Dry-run by default: uden ANTHROPIC_API_KEY returneres et noegternt fallback-
// udkast, saa floejet stadig virker og Kristian bare skriver svaret selv.
//
// Env:
//   ANTHROPIC_API_KEY   noeglen. Uden den: fallback-udkast.
//   LEAD_DRAFT_MODEL    valgfri model-override.
const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

export type LeadContext = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  message: string | null;
  kundetype: string | null;
  pakkeNavn: string | null;
  estimatMd: number;
  services: { navn: string; qty: number; enhed: string; freq: number }[];
};

export type Draft = { subject: string; body: string; model: string | null; simulated?: boolean };

const DKK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

/** Leadets fakta som ren tekst. Bruges baade i prompten og i Slack-beskeden. */
export function leadSummary(l: LeadContext): string {
  const lines = [
    `Navn: ${l.name}`,
    l.address ? `Adresse: ${l.address}` : null,
    l.phone ? `Telefon: ${l.phone}` : null,
    l.email ? `E-mail: ${l.email}` : null,
    l.kundetype ? `Kundetype: ${l.kundetype === "erhverv" ? "Erhverv" : "Privat"}` : null,
    l.pakkeNavn ? `Valgt pakke: ${l.pakkeNavn}` : null,
    l.estimatMd ? `Estimat: ${DKK.format(l.estimatMd)} kr/md` : null,
    l.message ? `Kundens besked: ${l.message}` : null,
  ].filter((x): x is string => x !== null);
  if (l.services.length) {
    lines.push("Valgte ydelser:");
    for (const s of l.services.slice(0, 15)) {
      lines.push(`  - ${s.navn}${s.qty ? ` (${DKK.format(s.qty)} ${s.enhed})` : ""}${s.freq ? ` x ${s.freq}/aar` : ""}`);
    }
    if (l.services.length > 15) lines.push(`  - og ${l.services.length - 15} mere`);
  }
  return lines.join("\n");
}

const SYSTEM =
  "Du skriver svarmails for Karltoffel, et dansk firma der klarer vinduespudsning og havearbejde. " +
  "Tonen er varm, jordnaer og kort. Du dur ikke til salgssprog eller superlativer. " +
  "Skriv paa dansk, du-form, som et rigtigt menneske der lige har set kundens forespoergsel.\n\n" +
  "Regler for mailen:\n" +
  "- Kvitter for forespoergslen og naevn kundens adresse.\n" +
  "- Prisen fra tilbudsmotoren er et ESTIMAT baseret paa maalinger fra luftfoto. " +
  "Sig tydeligt at vi ringer og bekraefter tallene, og at intet koster noget foer kunden siger ja.\n" +
  "- Lov ikke et praecist tidspunkt. Skriv at vi ringer hurtigst muligt.\n" +
  "- Ingen emojis. Ingen underskrift med navn, den saettes automatisk.\n" +
  "- Hold den under 150 ord.\n\n" +
  "Svar KUN med gyldig JSON i formatet {\"subject\": \"...\", \"body\": \"...\"} og intet andet.";

/** Nøgternt udkast naar AI ikke er tilgaengelig. Aldrig tomt, saa Kristian altid
 *  har noget at godkende eller rette i. */
function fallbackDraft(l: LeadContext): Draft {
  const fornavn = (l.name || "").trim().split(/\s+/)[0] || "";
  const hilsen = fornavn ? `Hej ${fornavn}` : "Hej";
  const adr = l.address ? ` paa ${l.address}` : "";
  return {
    subject: "Tak for din forespoergsel til Karltoffel",
    body:
      `${hilsen},\n\n` +
      `Tak fordi du skrev til os om opgaven${adr}.\n\n` +
      `Vi kigger din forespoergsel igennem og ringer til dig hurtigst muligt for at ` +
      `bekraefte tallene. Prisen fra beregneren er et estimat ud fra maalinger, saa vi ` +
      `vil gerne lige have den bekraeftet sammen med dig. Der er ingen binding, og ` +
      `intet koster noget, foer du siger ja.\n\n` +
      `Vi glaeder os til at snakke med dig.`,
    model: null,
    simulated: true,
  };
}

/** Skriv et udkast. `feedback` er Kristians kommentar til FORRIGE udkast, som
 *  modellen skal rette efter. Fejler aldrig haardt: ved enhver fejl returneres
 *  fallback-udkastet, saa godkendelsesfloejet altid har noget at vise. */
export async function draftReply(
  lead: LeadContext,
  previous?: { subject: string; body: string; feedback: string },
): Promise<Draft> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return fallbackDraft(lead);
  const model = process.env.LEAD_DRAFT_MODEL?.trim() || DEFAULT_MODEL;

  const userText = previous
    ? `Her er leadet:\n\n${leadSummary(lead)}\n\n` +
      `Du skrev foerst dette udkast:\n\nEmne: ${previous.subject}\n\n${previous.body}\n\n` +
      `Kristian har afvist det med denne feedback:\n\n${previous.feedback}\n\n` +
      `Skriv udkastet om, saa feedbacken er indarbejdet.`
    : `Her er leadet:\n\n${leadSummary(lead)}\n\nSkriv svarmailen.`;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: userText }],
      }),
    });
    if (!res.ok) {
      console.error("[lead-draft] Anthropic HTTP", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return fallbackDraft(lead);
    }
    const msg = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
    if (msg.stop_reason === "refusal") return fallbackDraft(lead);
    const text = msg.content?.find((b) => b.type === "text")?.text ?? "";
    // Modellen kan finde paa at pakke JSON ind i en kodeblok, saa klip den fri.
    const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const out = JSON.parse(raw) as { subject?: unknown; body?: unknown };
    const subject = typeof out.subject === "string" ? out.subject.trim() : "";
    const body = typeof out.body === "string" ? out.body.trim() : "";
    if (!subject || !body) return fallbackDraft(lead);
    return { subject: subject.slice(0, 200), body: body.slice(0, 5000), model };
  } catch (e) {
    console.error("[lead-draft] uventet fejl:", (e as Error).message);
    return fallbackDraft(lead);
  }
}
