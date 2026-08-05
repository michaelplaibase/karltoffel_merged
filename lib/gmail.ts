// Afsendelse via Gmail API som hej@karltoffel.dk, med samme service-konto
// (domain-wide delegation) som allerede bruges til Canva-login-koder — se
// karltoffel/CREDENTIALS.md. Erstatter Resend som primær transport, fordi
// karltoffel.dk (endnu) ikke er et verificeret afsenderdomæne i Resend, og en
// rigtig Google Workspace-postkasse har sin egen SPF/DKIM/domæne-omdømme.
//
// Dry-run by default: mangler GMAIL_SA_EMAIL / GMAIL_SA_KEY, logges der og
// returneres { ok:true, simulated:true } — intet sendes før nøglerne er sat.
import { createSign } from "node:crypto";

export type SendGmailInput = { to: string; subject: string; text: string; html?: string; replyTo?: string };
export type SendGmailResult = { ok: boolean; simulated?: boolean; id?: string; error?: string };

const IMPERSONATE = process.env.GMAIL_IMPERSONATE?.trim() || "hej@karltoffel.dk";

/** OAuth2 access token for service-kontoen, impersonerende IMPERSONATE (DWD). */
async function accessToken(saEmail: string, saKey: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) + "." +
    b64({ iss: saEmail, sub: IMPERSONATE, scope: "https://www.googleapis.com/auth/gmail.send", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
  const pem = saKey.replace(/\\n/g, "\n");
  const sig = createSign("RSA-SHA256").update(unsigned).sign(pem).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token-svar uden access_token");
  return data.access_token;
}

/** RFC 2822-besked, base64url-kodet — Gmail API kræver "raw" i det format. */
function buildRawMessage(input: SendGmailInput): string {
  const boundary = "karltoffel-" + Math.abs([...input.subject].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(16);
  const headers = [
    `From: Karltoffel <${IMPERSONATE}>`,
    `To: ${input.to}`,
    input.replyTo ? `Reply-To: ${input.replyTo}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
  ].filter((l): l is string => l !== null);

  if (!input.html) {
    const body = [...headers, `Content-Type: text/plain; charset="UTF-8"`, "", input.text].join("\r\n");
    return Buffer.from(body).toString("base64url");
  }

  const body = [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    input.text,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    input.html,
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(body).toString("base64url");
}

export async function sendGmail(input: SendGmailInput): Promise<SendGmailResult> {
  const saEmail = process.env.GMAIL_SA_EMAIL;
  const saKey = process.env.GMAIL_SA_KEY;

  if (!saEmail || !saKey) {
    console.log(`[gmail:dry-run] to=${input.to} subject=${JSON.stringify(input.subject)} (${input.text.length} tegn)`);
    return { ok: true, simulated: true };
  }

  try {
    const token = await accessToken(saEmail, saKey);
    const raw = buildRawMessage(input);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(IMPERSONATE)}/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Gmail ${res.status}: ${detail}`.slice(0, 300) };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "afsendelse via Gmail fejlede" };
  }
}
