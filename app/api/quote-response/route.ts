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

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Karltoffel</title>
<style>body{font-family:system-ui,sans-serif;background:#4C3718;color:#FFFFF0;max-width:480px;margin:60px auto;padding:0 20px;text-align:center}
h1{color:#FFF87B;font-size:22px}p{opacity:.9;line-height:1.5}</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function notifyStaff(subject: string, text: string): Promise<void> {
  try {
    const res = await sendEmail({ to: STAFF_EMAIL, subject, text });
    if (!res.ok) console.error(`[quote-response] staff-notifikation fejlede: ${res.error}`);
  } catch (e) {
    console.error("[quote-response] staff-notifikation exception:", e);
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const choiceRaw = url.searchParams.get("c") ?? "";
  const choice = (["accept", "maybe", "decline"] as const).find((c) => c === choiceRaw) as Choice | undefined;

  if (!token || !choice) return page("Ugyldigt link", "Linket mangler oplysninger. Ring til os på tlf., så hjælper vi dig videre.", 400);

  const result = await consumeQuoteToken(token, choice);
  if (!result.ok) {
    if (result.reason === "already_used") return page("Allerede besvaret", "Du har allerede svaret på dette tilbud. Har du brug for at ændre dit svar, så ring til os.");
    if (result.reason === "expired") return page("Linket er udløbet", "Tilbuddet er ikke længere aktivt. Kontakt os, hvis du stadig er interesseret.");
    return page("Ukendt link", "Vi kan ikke finde dette tilbud. Ring til os på tlf., så hjælper vi dig videre.", 404);
  }

  const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
  if (!lead) return page("Ukendt lead", "Noget gik galt vores side. Ring til os på tlf.", 404);

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
    return page("Tak for dit svar!", "Vi ringer til dig snarest for at bekræfte tid og de sidste detaljer.");
  }

  if (choice === "maybe") {
    await notifyStaff(`🤔 ${lead.name} er i tvivl om tilbuddet`, `${lead.name} klikkede "Måske" i tilbudsmailen. Følg op med en opringning: https://crm.karltoffel.dk/leads`);
    return page("Noteret!", "Vi ringer til dig for at høre, om vi kan svare på nogle spørgsmål.");
  }

  // decline
  await prisma.lead.update({ where: { id: lead.id }, data: { status: "rejected" } });
  await notifyStaff(`❌ ${lead.name} afviste tilbuddet`, `${lead.name} klikkede "Nej tak" i tilbudsmailen. Leadet er markeret afvist i CRM'et.`);
  return page("Tak for din tid", "Vi håber at høre fra dig en anden gang. God dag!");
}
