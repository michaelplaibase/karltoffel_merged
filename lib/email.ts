// The single e-mail transport module. Sends via Resend's REST API with fetch —
// no SDK, no new dependency (matches this repo's deliberately tiny dep list).
//
// Dry-run by default: when EMAIL_DRY_RUN=1, or RESEND_API_KEY / EMAIL_FROM are
// unset, it logs and returns { ok:true, simulated:true } instead of sending.
// That preserves the app's current stubbed behaviour in dev/preview and means
// nothing is ever sent until the key + verified sender are configured on Vercel.
export type SendEmailInput = { to: string; subject: string; text: string; html?: string; replyTo?: string };
export type SendEmailResult = { ok: boolean; simulated?: boolean; id?: string; error?: string };

// Loft på Resend-kaldet: mails afsendes ofte på en request-kritisk vej (fx
// lead-webhooken), så en langsom udbyder må ikke hænge funktionen ud over
// Vercels maxDuration.
const SEND_TIMEOUT_MS = 8000;

export async function sendEmail({ to, subject, text, html, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const reply = replyTo ?? process.env.EMAIL_REPLY_TO;

  if (process.env.EMAIL_DRY_RUN === "1" || !key || !from) {
    console.log(`[email:dry-run] to=${to} subject=${JSON.stringify(subject)} (${text.length} tegn)`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}), ...(reply ? { reply_to: reply } : {}) }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail}`.slice(0, 300) };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "afsendelse fejlede" };
  }
}
