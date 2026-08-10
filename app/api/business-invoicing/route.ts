import { NextResponse } from "next/server";
import { runBusinessBatchInvoicing } from "@/lib/business-invoicing";
import { requireSession, unauthorized } from "@/lib/api-auth";

// Erhvervs-samlefaktura — kører d. 20. hver måned (se vercel.json), fakturerer
// automatisk alle erhvervsordrer markeret "Udført" i perioden 20.-19. Ingen
// godkendelsestrin: se lib/business-invoicing.ts for den fulde regel/kilde.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  if (!isCron && (await requireSession()) == null) return unauthorized();

  const result = await runBusinessBatchInvoicing(new Date());
  return NextResponse.json(result);
}
