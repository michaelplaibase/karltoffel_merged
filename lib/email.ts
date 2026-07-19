// The single e-mail transport module. Sends via Resend's REST API with fetch —
// no SDK, no new dependency (matches this repo's deliberately tiny dep list).
//
// Dry-run by default: when EMAIL_DRY_RUN=1, or RESEND_API_KEY / EMAIL_FROM are
// unset, it logs and returns { ok:true, simulated:true } instead of sending.
// That preserves the app's current stubbed behaviour in dev/preview and means
// nothing is ever sent until the key + verified sender are configured on Vercel.
// `from`/`senderName` let a caller send under a different identity than the
// company default (e.g. AS the assigned handyman). `from` must still be a
// Resend-verified address; `senderName` sets the display name in front of it.
export type SendEmailInput = { to: string; subject: string; text: string; replyTo?: string; from?: string; senderName?: string };
export type SendEmailResult = { ok: boolean; simulated?: boolean; id?: string; error?: string; from?: string };

/** Extract the bare address from a "Name <addr>" or plain "addr" from-header. */
function addrOnly(s: string): string {
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

/**
 * Resolve the from/reply-to identity for sending AS a handyman.
 * - If KARL_SENDER_DOMAIN is set, use a per-user verified sender
 *   `<username>@<KARL_SENDER_DOMAIN>` with the handyman's name + reply-to = their
 *   e-mail.
 * - Otherwise fall back to the company EMAIL_FROM address (from undefined) but
 *   still stamp the handyman's name as display and reply-to = their e-mail.
 */
export function senderForUser(u: { username: string; firstName: string; lastName: string; email: string | null }): {
  from?: string;
  senderName: string;
  replyTo?: string;
} {
  const senderName = `${u.firstName} ${u.lastName}`.trim() || "Karltoffel";
  const domain = process.env.KARL_SENDER_DOMAIN?.trim();
  const replyTo = u.email ?? undefined;
  if (domain && u.username) return { from: `${u.username.toLowerCase()}@${domain}`, senderName, replyTo };
  return { senderName, replyTo };
}

export async function sendEmail({ to, subject, text, replyTo, from, senderName }: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const baseFrom = from ?? process.env.EMAIL_FROM;
  const reply = replyTo ?? process.env.EMAIL_REPLY_TO;
  // Compose the final From header: apply an optional display name in front of the
  // resolved (verified) address.
  const fromHeader = baseFrom ? (senderName ? `${senderName} <${addrOnly(baseFrom)}>` : baseFrom) : undefined;

  if (process.env.EMAIL_DRY_RUN === "1" || !key || !fromHeader) {
    console.log(`[email:dry-run] from=${fromHeader ?? "(unset)"} to=${to} subject=${JSON.stringify(subject)} (${text.length} tegn)`);
    return { ok: true, simulated: true, from: fromHeader };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fromHeader, to, subject, text, ...(reply ? { reply_to: reply } : {}) }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail}`.slice(0, 300) };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id, from: fromHeader };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "afsendelse fejlede" };
  }
}
