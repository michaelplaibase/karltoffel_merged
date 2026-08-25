// Engangs-tokens til Ja/Måske/Nej-links i tilbudsmailen. Se prisma-modellen
// QuoteToken: ét token pr. udsendt tilbud. Ja/Nej forbruger tokenet (usedAt+
// choice sat) — et gammelt eller videresendt link virker derefter ikke igen.
// "Måske" er IKKE et endeligt svar og forbruger derfor ikke tokenet: kunden
// skal stadig kunne klikke Ja/Nej inden for de lovede 30 dages gyldighed.
import { randomBytes } from "node:crypto";
import { prisma } from "./db";

const TOKEN_TTL_DAYS = 30; // matcher "Gyldig i 30 dage" i tilbudsmailen (lib/quote-html.ts)

export async function issueQuoteToken(leadId: number): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000);
  await prisma.quoteToken.create({ data: { token, leadId, expiresAt } });
  return token;
}

export type Choice = "accept" | "maybe" | "decline";

export type ConsumeResult =
  | { ok: true; leadId: number }
  | { ok: false; reason: "not_found" | "expired" | "already_used" };

/** Forbrug et token. Atomisk mod dobbelt-klik (to samtidige requests med samme
 *  token): updateMany med usedAt:null i where-clausen er selve låsen — kun den
 *  request der rammer count:1 vinder retten til at handle på valget.
 *
 *  Undtagelsen er "maybe": valget noteres (choice), men usedAt forbliver null,
 *  så et efterfølgende "Ja tak"/"Nej tak" stadig kan forbruge tokenet — ellers
 *  ville en tøvende kunde lande på "already_used", selvom mailen lover 30 dages
 *  gyldighed. */
export async function consumeQuoteToken(token: string, choice: Choice): Promise<ConsumeResult> {
  const row = await prisma.quoteToken.findUnique({ where: { token } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.usedAt) return { ok: false, reason: "already_used" };

  if (choice === "maybe") {
    // Notér valget uden at forbruge — kun hvis intet endeligt svar nåede først.
    await prisma.quoteToken.updateMany({
      where: { token, usedAt: null },
      data: { choice },
    });
    return { ok: true, leadId: row.leadId };
  }

  const claimed = await prisma.quoteToken.updateMany({
    where: { token, usedAt: null },
    data: { usedAt: new Date(), choice },
  });
  if (claimed.count === 0) return { ok: false, reason: "already_used" }; // tabte kapløbet mod en samtidig request

  return { ok: true, leadId: row.leadId };
}
