// POST /api/giftcards/checkout — offentligt endpoint bag gavekort-købsflowet
// på det statiske site (/c/det-vi-ordner/gavekort). Ingen session — det KALDES
// af kundens browser, så der må ikke ligge hemmeligheder i requesten; alt hvad
// der bruges (design, beløb, tekster) valideres server-side her.
//
// FASE 0 (MobilePay, manuel): intet betalingskald her. Ruten validerer input,
// opretter GiftCardOrder(status=awaiting_payment) og poster en Slack-
// notifikation. Teamet sender bagefter en MobilePay-betalingsanmodning manuelt
// via MobilePay Business-appen og markerer betalingen i CRM (/giftcards) —
// gavekortskoden genereres først dér (se app/actions/giftcards.ts).
//
// Stripe er forberedt (felter på modellen + app/api/giftcards/webhook|confirm)
// men KALDES IKKE i fase 0.
import { prisma } from "@/lib/db";
import { postMessage, leadsChannel } from "@/lib/slack";
import type { NextRequest } from "next/server";


// CORS: det statiske site (karltoffel.dk + Vercel previews) kalder dette
// endpoint direkte fra kundens browser.
const ALLOWED_ORIGINS = [
  "https://karltoffel.dk",
  "https://www.karltoffel.dk",
];
const ALLOWED_ORIGIN_SUFFIX = ".vercel.app"; // preview-deployments

function corsHeaders(origin: string | null): Record<string, string> {
  const ok = !!origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(ALLOWED_ORIGIN_SUFFIX));
  return ok
    ? { "access-control-allow-origin": origin as string, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" }
    : {};
}

export async function OPTIONS(req: NextRequest): Promise<Response> {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...corsHeaders(origin) } });
}

// De 7 design-navne som gavekort-siden sender (inkl. anledningsteksten der
// vises på kortet — gemmes på ordren så teamet kan gengive kortet 1:1 ved
// afsendelse).
const DESIGNS: Record<string, string> = {
  kartoffelgaven: "Gode ting udefra. Mere overskud indenfor.",
  foedselsdagskartofflen: "Ét år ældre. Nul flere opgaver.",
  julemosset: "Glædelig jul — og pyh, tagrenderne klarer vi.",
  morsdagskartofflen: "Hun har ryddet op i dit liv i 30 år. Lad os tage haven.",
  farsdagskartofflen: "Far har alt nok værktøj. Giv ham tid til at bruge det.",
  "flytte-kartofflen": "Nyt hus, nye kartofler. Vi tager det grimme arbejde.",
  kartoffelrosen: "Smukkere end blomster. Og de vander sig selv.",
};

const MIN_AMOUNT_MINOR = 50_000; // 500 kr. i øre
const MAX_AMOUNT_MINOR = 100_000_000; // 1.000.000 kr. — sikkerhedsloft
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\d{8}$/; // dansk mobilnr., +45/landekode strippet

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const normPhone = (p: string) => p.replace(/[^\d]/g, "").replace(/^(45|0045)(?=\d{8}$)/, "");
const kr = (minor: number) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(minor / 100);

export async function POST(req: NextRequest): Promise<Response> {
  const origin = req.headers.get("origin");
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Ugyldig forespørgsel." }, 400, origin);
  }

  // --- Validering (alt server-side; klienten kan ikke stole på) ---
  const design = str(body.design, 60);
  const occasion = DESIGNS[design];
  if (!occasion) return json({ error: "Vælg venligst et af de syv kort-designs." }, 400, origin);

  const amountMinor = typeof body.amountMinor === "number" && Number.isInteger(body.amountMinor)
    ? body.amountMinor
    : Math.round(Number(body.amountMinor) * 100 || 0);
  if (!Number.isInteger(amountMinor) || amountMinor < MIN_AMOUNT_MINOR) {
    return json({ error: "Gavekortet skal være mindst 500 kr." }, 400, origin);
  }
  if (amountMinor > MAX_AMOUNT_MINOR) return json({ error: "Beløbet er desværre for højt. Kontakt os på hej@karltoffel.dk." }, 400, origin);

  const recipientName = str(body.recipientName, 120);
  const buyerName = str(body.buyerName, 120);
  const recipientEmail = str(body.recipientEmail, 200).toLowerCase();
  const buyerEmail = str(body.buyerEmail, 200).toLowerCase();
  const buyerPhone = normPhone(str(body.buyerPhone, 20));
  const message = str(body.message, 300);

  if (!recipientName) return json({ error: "Skriv modtagerens navn." }, 400, origin);
  if (!buyerName) return json({ error: "Skriv dit eget navn." }, 400, origin);
  if (!EMAIL_RE.test(recipientEmail)) return json({ error: "Modtagerens e-mail ser ikke rigtig ud." }, 400, origin);
  if (!EMAIL_RE.test(buyerEmail)) return json({ error: "Din e-mail ser ikke rigtig ud." }, 400, origin);
  if (!PHONE_RE.test(buyerPhone)) return json({ error: "Indtast dit mobilnummer (8 cifre, origin) — det bruger vi til MobilePay-betalingen." }, 400);
  if (!message) return json({ error: "Skriv en personlig besked til modtageren." }, 400, origin);

  const order = await prisma.giftCardOrder.create({
    data: {
      amountMinor,
      currency: "dkk",
      design,
      occasion,
      message,
      recipientName,
      recipientEmail,
      buyerName,
      buyerEmail,
      buyerPhone,
      status: "awaiting_payment",
    },
  });

  // Slack-notifikation — samme mønster som lead-flowet (lib/slack.ts, dry-run
  // som standard: uden SLACK_BOT_TOKEN logges beskeden blot).
  const text =
    `🎁 Gavekort bestilt: ${kr(amountMinor)} kr. ` +
    `Til: ${recipientName} (${recipientEmail}). ` +
    `Fra: ${buyerName} (MobilePay: ${buyerPhone}). ` +
    `Kode genereres efter betaling.`;
  const slack = await postMessage({ channel: process.env.SLACK_GIFTCARD_CHANNEL?.trim() || leadsChannel(), text });
  if (!slack.ok && !slack.simulated) {
    // Ordren er gemt — en fejlet Slack-ping må ikke blokere kundens bestilling.
    console.error(`[giftcards:checkout] Slack-fejl for ordre ${order.id}: ${slack.error}`);
  }

  return json({ ok: true, orderId: order.id }, 200, origin);
}
