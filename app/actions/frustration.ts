"use server";

// Frustrationsknap — mødereferat 2026-08-03: Michael vil have en knap
// (uro-ikon) i CRM'et, der lader teamet i marken (Christian, Mika, m.fl.)
// hurtigt logge fejl og tage screenshots, sendt direkte til hans indbakke.
// Sender via samme e-mail-transport som resten af systemet (lib/email.ts —
// Gmail/Resend, dry-run indtil nøglerne er sat).
import { getSessionUser } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email";

export type FrustrationReportState = { sent?: boolean; error?: string };

const TO = process.env.FRUSTRATION_REPORT_EMAIL?.trim() || "hej@karltoffel.dk";
// Grænse matcher Vercel Server Actions' body-limit med luft til base64-overhead
// (~33%) og øvrige felter — 3 MB rå billeddata er rigeligt til en telefon-screenshot.
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;

export async function submitFrustrationReport(_prev: FrustrationReportState, formData: FormData): Promise<FrustrationReportState> {
  const me = await getSessionUser();
  if (!me) return { error: "Du skal være logget ind." };

  const message = String(formData.get("message") ?? "").trim();
  const page = String(formData.get("page") ?? "").trim();
  if (!message) return { error: "Beskriv kort, hvad der gik skævt." };

  const screenshot = formData.get("screenshot");
  let attachmentNote = "Intet screenshot vedhæftet.";
  let inlineImage = "";
  if (screenshot instanceof File && screenshot.size > 0) {
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return { error: "Screenshot er for stort (maks. 3 MB) — prøv at beskære det." };
    }
    const buf = Buffer.from(await screenshot.arrayBuffer());
    const b64 = buf.toString("base64");
    attachmentNote = `Screenshot vedhæftet (${screenshot.type || "billede"}, ${(screenshot.size / 1024).toFixed(0)} KB).`;
    // lib/email.ts har ingen attachment-parameter — vi indlejrer billedet som
    // inline data-URI i HTML-delen i stedet (virker i alle moderne mailklienter,
    // Gmail/Outlook web/mobil inkl.).
    inlineImage = `<div style="margin-top:16px"><img src="data:${screenshot.type || "image/png"};base64,${b64}" style="max-width:100%;border:1px solid #ddd;border-radius:6px" /></div>`;
  }

  const navn = `${me.firstName} ${me.lastName}`.trim() || me.username;
  const text = [
    `Frustrationsrapport fra ${navn}`,
    ``,
    `Side: ${page || "ukendt"}`,
    ``,
    message,
    ``,
    attachmentNote,
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1c140b">
<p><b>Frustrationsrapport fra ${escapeHtml(navn)}</b></p>
<p><b>Side:</b> ${escapeHtml(page || "ukendt")}</p>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>
${inlineImage}
</div>`;

  const res = await sendEmail({
    to: TO,
    subject: `🚩 Frustrationsrapport — ${navn} (${page || "ukendt side"})`,
    text,
    html,
  });
  if (!res.ok) return { error: `Kunne ikke sende rapporten: ${res.error ?? "ukendt fejl"}` };
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
