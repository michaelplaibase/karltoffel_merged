"use server";

// Anmeldelses-anmodning (Kristian, 2026-09-08): send en kort tak + Google-link
// til kunden efter en afsluttet ordre. Ét-kliks fra ordresiden — IKKE automatisk
// (Michael stoppede bevidst automails 2026-08; samme konvention som
// lead-opfølgningen). Google-linket sættes under Indstillinger (route
// "anmeldelser") og kan stå tomt — handlingen fejler da med en venlig besked,
// fordi en anmeldelses-mail uden link er spildt arbejde.
import { guardAction } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getTemplateValues, getSettingsValues } from "@/lib/settings-store";
import { renderTemplate } from "@/lib/quote-render";
import { sendEmail } from "@/lib/email";
import { REVIEW_REQUEST_TEMPLATE } from "@/lib/review-request-template";
import { revalidatePath } from "next/cache";

export type ReviewRequestState = { ok?: boolean; error?: string; message?: string };

/** Det konfigurerede Google-review-link (Indstillinger → Anmeldelser). */
export async function getGoogleReviewLink(): Promise<string> {
  const values = await getSettingsValues("anmeldelser");
  return values["reviewLink"]?.[0]?.trim() ?? "";
}

const EMAIL_RE_REVIEW = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Send den (eventuelt redigerede) anmeldelses-mail for en afsluttet ordre. */
export async function sendReviewRequest(_prev: ReviewRequestState, formData: FormData): Promise<ReviewRequestState> {
  await guardAction();
  const orderId = Number(formData.get("orderId"));
  const to = String(formData.get("to") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!Number.isInteger(orderId)) return { error: "Ugyldig ordre." };
  if (!EMAIL_RE_REVIEW.test(to)) return { error: "Angiv en gyldig e-mailadresse." };
  if (!subject) return { error: "Angiv et emne." };
  if (!body) return { error: "Beskeden er tom." };

  const res = await sendEmail({ to, subject, text: body });
  if (!res.ok) return { error: `Kunne ikke sende anmeldelses-mailen: ${res.error ?? "ukendt fejl"}` };

  // Log på ordren: afsendelsen bekræftes i UI'et (composeren viser grøn
  // bekræftelse) — ingen ekstra DB-kolonne. Listen "klar til anmeldelse"
  // på /fakturering filtrerer udelukkende på completedAt, så dobbelt-send er
  // noget personalet selv kan se i afsendelsesbekræftelsen.
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return {
    ok: true,
    message: res.simulated
      ? "Anmeldelses-mailen er klar (simuleret – ingen e-mail-udbyder er konfigureret endnu)."
      : `Anmeldelses-mail sendt til ${to}.`,
  };
}

/** Byg udkast til anmeldelses-mailen på en ordre (modtager/emne/brødtekst).
 *  Returnerer null hvis ordren/kunden ikke kan anmeldes (ingen e-mail). */
export async function buildReviewRequestDraft(orderId: number): Promise<{
  to: string; subject: string; body: string; orderNo: number; customer: string;
} | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { contact: { select: { name: true, email: true } }, tasks: { select: { description: true } } },
  });
  if (!order?.contact.email) return null;
  const [company, tpl, reviewLink] = await Promise.all([
    prisma.company.findFirst(),
    Promise.resolve(REVIEW_REQUEST_TEMPLATE),
    getGoogleReviewLink(),
  ]);
  const values = await getTemplateValues("anmeldelse");
  const fornavn = order.contact.name.trim().split(/\s+/)[0] || order.contact.name;
  const vars: Record<string, string> = {
    kunde_fornavn: fornavn,
    leverings_adresse: order.deliveryAddress,
    // Tomt link → flettet som en hjælpsom besked i stedet for et dødt token.
    anmeldelse_link: reviewLink || "(link til Google-anmeldelser mangler at blive sat op under Indstillinger)",
    dit_firmanavn: company?.name ?? "Karltoffel",
    dit_telefonnummer: company?.phone ?? "",
    din_email: company?.email ?? "",
  };
  const subjectTpl = values.subjects?.[0] ?? tpl.subjects[0]?.val ?? "";
  const bodyTpl = values.body ?? tpl.body ?? "";
  return {
    to: order.contact.email,
    subject: renderTemplate(subjectTpl, vars),
    body: renderTemplate(bodyTpl, vars),
    orderNo: order.id,
    customer: order.contact.name,
  };
}
