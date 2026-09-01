// GET /api/giftcards/confirm?session=cs_test_... — FORBEREDT men IKKE AKTIV i
// fase 0 (MobilePay betales manuelt). Bruges af success-redirecten når/om
// Stripe-integrationen tages i brug: slår ordren op via Stripe-sessionen og
// returnerer dens status, så sitside kan vise korrekt besked.
//
// Fail-closed: uden STRIPE_SECRET_KEY svarer ruten 503.
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(req: NextRequest): Promise<Response> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return json({ error: "Betalingsintegrationen er ikke aktiv endnu." }, 503);

  const sessionId = req.nextUrl.searchParams.get("session")?.trim();
  if (!sessionId || !/^cs_(test|live)_/.test(sessionId)) {
    return json({ error: "Ugyldig session." }, 400);
  }

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return json({ error: "Sessionen kunne ikke slås op." }, 502);

  const orderId = String((data.metadata as Record<string, string> | undefined)?.orderId ?? "");
  const order = orderId ? await prisma.giftCardOrder.findUnique({ where: { id: orderId } }) : null;
  if (!order) return json({ error: "Ordren blev ikke fundet." }, 404);

  return json({ status: order.status, paid: data.payment_status === "paid", orderId: order.id });
}
