"use server";

// Send a quote ("tilbud") e-mail. The composer shows a pre-rendered subject +
// body that staff may edit before sending, so we send exactly the approved text
// (money/details are already baked into it). Delivery goes through lib/email,
// which dry-runs until a provider is configured on Vercel.
import { guardAction } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email";

export type QuoteState = { ok?: boolean; error?: string; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendQuoteEmail(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  await guardAction();
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!EMAIL_RE.test(to)) return { error: "Angiv en gyldig e-mailadresse." };
  if (!subject) return { error: "Angiv et emne." };
  if (!body) return { error: "Beskeden er tom." };

  const res = await sendEmail({ to, subject, text: body });
  if (!res.ok) return { error: `Kunne ikke sende tilbuddet: ${res.error ?? "ukendt fejl"}` };
  return {
    ok: true,
    message: res.simulated
      ? "Tilbuddet er klar (simuleret – ingen e-mail-udbyder er konfigureret endnu)."
      : `Tilbud sendt til ${to}.`,
  };
}
