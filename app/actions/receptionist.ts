"use server";

// AI Receptionist prototype — answers customer-style questions about orders,
// bookings/availability, and price by querying the REAL CRM data (Prisma via
// the same lib/mcp-tools.ts functions Karl's MCP server already exposes).
// No mock data: getCustomer/listAvailability hit the production database.
// Requires a logged-in portal session (guardAction), same as every other
// server action in this app — this is an internal demo surface, not a public
// customer-facing endpoint (that would need its own auth/rate-limiting before
// going live, see README-AI-RECEPTIONIST.md).
import { guardAction } from "@/lib/api-auth";
import { getCustomer, listAvailability } from "@/lib/mcp-tools";

export type ReceptionistAnswer = {
  ok: boolean;
  lang: "da" | "en";
  text: string;
  matchedCustomer?: string;
  error?: string;
};

/** Very small heuristic: Danish if it contains æøå or common Danish words, else English. */
function detectLang(s: string): "da" | "en" {
  if (/[æøåÆØÅ]/.test(s)) return "da";
  const daWords = /\b(hvornår|kommer|ordre|rens|pris|hej|jeg|kunde|næste|hvad|kan|i|du|min|mit)\b/i;
  const enWords = /\b(when|status|order|price|next|appointment|hello|my|can|you)\b/i;
  if (daWords.test(s) && !enWords.test(s)) return "da";
  return "en";
}

function classifyIntent(q: string): "status" | "next" | "price" | "availability" | "unknown" {
  const s = q.toLowerCase();
  if (/(hvornår|kommer|next|appointment|næste besøg|når kommer)/.test(s)) return "next";
  if (/(status|ordre|order|hvor langt|hvad sker)/.test(s)) return "status";
  if (/(pris|price|hvad koster|cost)/.test(s)) return "price";
  if (/(ledig|availability|book|tid|slot)/.test(s)) return "availability";
  return "unknown";
}

export async function answerReceptionistQuery(
  customerQuery: string,
  question: string
): Promise<ReceptionistAnswer> {
  await guardAction();

  const lang = detectLang(question);
  const intent = classifyIntent(question);
  const cq = customerQuery.trim();

  if (!cq) {
    return {
      ok: false,
      lang,
      text:
        lang === "da"
          ? "Jeg har brug for kundens navn, telefonnummer eller e-mail for at kunne slå ordren op."
          : "I need the customer's name, phone number, or e-mail to look up their order.",
    };
  }

  const result = await getCustomer({ query: cq });
  const match = result.matches?.[0];

  if (!match) {
    return {
      ok: false,
      lang,
      text:
        lang === "da"
          ? `Jeg kunne ikke finde en kunde der matcher "${cq}". Kan du give mig et telefonnummer eller den fulde adresse?`
          : `I couldn't find a customer matching "${cq}". Could you give me a phone number or the full address?`,
    };
  }

  const recent = match.recentOrders ?? [];
  const upcoming = recent
    .filter((o) => o.status !== "Udført" && o.status !== "Afsluttet" && o.status !== "Sprunget over")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const next = upcoming[0];
  const last = recent[0];

  let text: string;

  if (intent === "next" || intent === "availability") {
    if (next) {
      text =
        lang === "da"
          ? `Jeg kan se, at vi kommer til ${match.name} d. ${next.date} på adressen ${next.address}. Status lige nu er "${next.status}". Opgaver: ${next.tasks.join(", ") || "ikke angivet"}.`
          : `I can see we're scheduled to visit ${match.name} on ${next.date} at ${next.address}. Current status is "${next.status}". Tasks: ${next.tasks.join(", ") || "not specified"}.`;
    } else {
      const avail = await listAvailability({ durationMin: 60 });
      const earliest = avail.earliest;
      text =
        lang === "da"
          ? `${match.name} har ingen planlagt besøg lige nu. Første ledige tid generelt er ${earliest ? `${earliest.firstAvailable?.date} kl. ${earliest.firstAvailable?.from}` : "ikke fundet"} — vil du booke det?`
          : `${match.name} has no scheduled visit right now. The next generally available slot is ${earliest ? `${earliest.firstAvailable?.date} at ${earliest.firstAvailable?.from}` : "not found"} — would you like to book it?`;
    }
  } else if (intent === "status") {
    if (last) {
      text =
        lang === "da"
          ? `Den seneste ordre for ${match.name} (#${last.id}) har status "${last.status}", planlagt/leveret d. ${last.date} på ${last.address}.`
          : `The most recent order for ${match.name} (#${last.id}) has status "${last.status}", scheduled/delivered on ${last.date} at ${last.address}.`;
    } else {
      text =
        lang === "da"
          ? `Jeg kan ikke finde nogen ordrer for ${match.name} endnu.`
          : `I can't find any orders for ${match.name} yet.`;
    }
  } else if (intent === "price") {
    text =
      lang === "da"
        ? `${match.name} har ${match.subscriptionCount} aktive abonnement(er) og en samlet omsætning i år på ${match.revenueYtd ?? "ikke registreret"} kr. For en konkret pris på en ny opgave, foreslår jeg vi booker et opkald med en medarbejder.`
        : `${match.name} has ${match.subscriptionCount} active subscription(s) and year-to-date revenue of ${match.revenueYtd ?? "not recorded"} kr. For a specific quote on a new task, I'd suggest we book a call with a team member.`;
  } else {
    text =
      lang === "da"
        ? `Jeg fandt ${match.name} (${match.address}). ${next ? `Næste besøg er d. ${next.date}.` : "Der er ikke planlagt noget besøg lige nu."} Spørg mig endelig om ordrestatus, næste besøg eller pris.`
        : `I found ${match.name} (${match.address}). ${next ? `The next visit is on ${next.date}.` : "There's no visit scheduled right now."} Feel free to ask about order status, the next visit, or price.`;
  }

  return { ok: true, lang, text, matchedCustomer: match.name };
}
