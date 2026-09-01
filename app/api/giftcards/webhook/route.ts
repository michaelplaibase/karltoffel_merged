// POST /api/giftcards/webhook — Stripe-webhook, FORBEREDT men IKKE AKTIV i
// fase 0 (MobilePay betales manuelt; se app/api/giftcards/checkout). Ruten
// aktiveres først når STRIPE_WEBHOOK_SECRET sættes på Vercel-projektet
// (karltoffel-crm) med event `checkout.session.completed`.
//
// Fail-closed: uden STRIPE_WEBHOOK_SECRET svarer ruten altid 503 — intet
// ukendt/uvinceret payload kan ændre en ordre eller generere en kode.
// Verifikation: manual HMAC-SHA256 over `${t}.${rawBody}` (ingen SDK — samme
// afhængigheds-fri mønster som lib/slack.ts og lib/email.ts).
import { prisma, isUniqueViolation } from "@/lib/db";
import { postMessage, leadsChannel } from "@/lib/slack";
import type { NextRequest } from "next/server";

const kr = (minor: number) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(minor / 100);

/** KT-XXXX-XXXX-XXXX uden tvetydige tegn (ingen 0/O, 1/I) + kollisionstjek. */
async function generateCode(): Promise<string> {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "KT-";
    for (let block = 0; block < 3; block++) {
      for (let i = 0; i < 4; i++) code += alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length];
      if (block < 2) code += "-";
    }
    if (!(await prisma.giftCardOrder.findUnique({ where: { code } }))) return code;
  }
  throw new Error("Kunne ikke generere et unikt gavekortskode efter 20 forsøg");
}

/** Verificér Stripe-Signature-headeren (t=<ts>,v1=<hmac>). */
async function signatureOk(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  // Afvis ældre end 5 min (replay-beskyttelse, som Stripe selv anbefaler).
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== v1.length) return false;
  let diff = 0; // konstant-tids sammenligning
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[giftcards:webhook] 503 — STRIPE_WEBHOOK_SECRET er ikke sat (fase 0: MobilePay betales manuelt)");
    return new Response("Not configured", { status: 503 });
  }

  const raw = await req.text();
  if (!(await signatureOk(raw, req.headers.get("stripe-signature"), secret))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  // Dedupe på event.id: Stripe kan retraye — en allerede behandlet event er en no-op.
  if (event.type === "checkout.session.completed" && event.data?.object) {
    const session = event.data.object;
    const sessionId = String(session.id ?? "");
    const orderId = String((session.metadata as Record<string, string> | undefined)?.orderId ?? "");
    if (sessionId && orderId) {
      const order = await prisma.giftCardOrder.findUnique({ where: { id: orderId } });
      // status-check er samtidig dedupe: allerede paid/sent = intet at gøre.
      if (order && order.status === "awaiting_payment" && order.stripeSessionId !== sessionId) {
        try {
          const updated = await prisma.giftCardOrder.update({
            where: { id: order.id },
            data: {
              status: "paid",
              stripeSessionId: sessionId,
              stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
              code: await generateCode(),
            },
          });
          await postMessage({
            channel: process.env.SLACK_GIFTCARD_CHANNEL?.trim() || leadsChannel(),
            text: `✅ Gavekort betalt (Stripe): ${kr(updated.amountMinor)} kr. Til: ${updated.recipientName} (${updated.recipientEmail}). Kode: ${updated.code}. Send kortet pr. mail.`,
          });
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
        }
      }
    }
  }

  // Stripe forventer 200 hurtigt — alt tungt skal være async/dry-run allerede.
  return new Response("ok", { status: 200 });
}
