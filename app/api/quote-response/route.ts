import { prisma } from "@/lib/db";
import { consumeQuoteToken, type Choice } from "@/lib/quote-tokens";
import { convertLeadCore } from "@/app/actions/leads";
import { sendEmail } from "@/lib/email";
import type { NextRequest } from "next/server";

// Kunden lander her fra Ja/Måske/Nej-knappen i tilbudsmailen. Ingen login —
// tokenet ER autorisationen (se lib/quote-tokens.ts: engangs, udløber efter
// 30 dage, atomisk forbrugt så et videresendt/gammelt link ikke virker igen).
// GET (ikke POST): det er et link i en e-mail, ikke en formular — men fordi
// det MUTERER state, forbruges tokenet atomisk (updateMany med usedAt:null i
// where), så et automatisk link-preview/scanner i kundens mailklient højst
// kan "vinde" kapløbet én gang, aldrig udløse dobbelt-konvertering.

const STAFF_EMAIL = process.env.STAFF_NOTIFY_EMAIL?.trim() || "kristian@karltoffel.dk";
const SITE_BASE = (process.env.SITE_BASE_URL?.trim() || "https://karltoffel.dk").replace(/\/$/, "");

/** Kunden skal lande på karltoffel.dk, ikke crm.karltoffel.dk — samme brand,
 *  samme side som resten af sitet (Michael, 2026-08-06: "Den skal være
 *  KNIVSKARP på brand identiteten"). Selve mutationen (token forbrugt, lead
 *  opdateret) er allerede sket FØR redirect'et; siden på karltoffel.dk/tak er
 *  ren visning og vælger sin tekst ud fra ?c=. */
function tak(outcome: "accept" | "maybe" | "decline" | "already_used" | "expired" | "error", navn?: string): Response {
  const params = new URLSearchParams({ c: outcome });
  if (navn) params.set("navn", navn);
  return Response.redirect(`${SITE_BASE}/tak?${params.toString()}`, 302);
}

async function notifyStaff(subject: string, text: string): Promise<void> {
  try {
    const res = await sendEmail({ to: STAFF_EMAIL, subject, text });
    if (!res.ok) console.error(`[quote-response] staff-notifikation fejlede: ${res.error}`);
  } catch (e) {
    console.error("[quote-response] staff-notifikation exception:", e);
  }
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Skriftlig bekræftelse til kunden ved "Ja tak" — uden den har kunden intet
 *  andet end en webside, der forsvinder når fanen lukkes. Må ALDRIG vælte
 *  eller forsinke svaret på selve klikket: samme try/catch-kontrakt som
 *  notifyStaff, fejl logges men returnerer intet til kunden at reagere på. */
async function notifyCustomer(to: string, name: string, company: { name: string; phone: string | null; email: string | null }): Promise<void> {
  const kontakt = [company.phone, company.email].filter(Boolean).join(" · ");
  const text = [
    `Hej ${firstName(name)}`,
    ``,
    `Tak for din bestilling hos ${company.name}! Vi har modtaget din accept af tilbuddet.`,
    ``,
    `Vi ringer til dig snarest for at bekræfte den endelige tid og aftale de sidste detaljer. Der er endnu ikke booket en håndværker eller sendt nogen ud — det sker først, når vi har talt sammen.`,
    ``,
    `Har du spørgsmål i mellemtiden, er du velkommen til at kontakte os${kontakt ? `: ${kontakt}` : "."}`,
    ``,
    `De bedste hilsner`,
    company.name,
  ].join("\n");
  try {
    const res = await sendEmail({ to, subject: `Tak for din bestilling hos ${company.name}`, text });
    if (!res.ok) console.error(`[quote-response] kunde-bekræftelse fejlede: ${res.error}`);
  } catch (e) {
    console.error("[quote-response] kunde-bekræftelse exception:", e);
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const choiceRaw = url.searchParams.get("c") ?? "";
  const choice = (["accept", "maybe", "decline"] as const).find((c) => c === choiceRaw) as Choice | undefined;

  if (!token || !choice) return tak("error");

  const result = await consumeQuoteToken(token, choice);
  if (!result.ok) {
    if (result.reason === "already_used") return tak("already_used");
    if (result.reason === "expired") return tak("expired");
    return tak("error");
  }

  const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
  if (!lead) return tak("error");
  const fornavn = firstName(lead.name);

  if (choice === "accept") {
    // Samme konvertering som når staff godkender i CRM'et: opretter kunde +
    // AFVENTENDE abonnement/ordre. "Afventende" er bevidst — der sendes ikke
    // en håndværker ud, og der oprettes intet bindende, før nogen har ringet
    // og bekræftet tid/pris med kunden (samme flow som alle andre leads).
    const contactId = await convertLeadCore(lead.id);
    await notifyStaff(
      `✅ ${lead.name} accepterede tilbuddet`,
      `${lead.name} har klikket "Ja tak" i tilbudsmailen.\n\n` +
        (contactId != null
          ? `Oprettet som kunde: https://crm.karltoffel.dk/customers/${contactId}\nRing og bekræft tid/pris — abonnementet/ordren afventer stadig godkendelse.`
          : `Kunne IKKE konverteres automatisk (mangler firmaopsætning eller leadet var allerede slettet) — tjek CRM'et manuelt: https://crm.karltoffel.dk/leads`),
    );
    if (lead.email) {
      const company = await prisma.company.findFirst();
      if (company) await notifyCustomer(lead.email, lead.name, company);
    }
    return tak("accept", fornavn);
  }

  if (choice === "maybe") {
    await notifyStaff(`🤔 ${lead.name} er i tvivl om tilbuddet`, `${lead.name} klikkede "Måske" i tilbudsmailen. Følg op med en opringning: https://crm.karltoffel.dk/leads`);
    return tak("maybe", fornavn);
  }

  // decline
  await prisma.lead.update({ where: { id: lead.id }, data: { status: "rejected" } });
  await notifyStaff(`❌ ${lead.name} afviste tilbuddet`, `${lead.name} klikkede "Nej tak" i tilbudsmailen. Leadet er markeret afvist i CRM'et.`);
  return tak("decline", fornavn);
}
