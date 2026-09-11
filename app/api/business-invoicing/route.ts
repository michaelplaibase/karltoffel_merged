import { NextResponse } from "next/server";
import { runBusinessBatchInvoicing } from "@/lib/business-invoicing";
import { runMaanedrapporter } from "@/lib/maanedrapport-send";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

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
  // Kørsel via cron (Bearer CRON_SECRET) eller af en indlogget ADMINISTRATOR.
  // Batchfakturering er virksomhedsbred, så en almindelig medarbejder afvises.
  if (!isCron) {
    const me = await getSessionUser();
    if (me == null) return unauthorized();
    if (!me.isAdmin) return forbidden();
  }

  const result = await runBusinessBatchInvoicing(new Date());

  // Månedrapporter (Thomas 2026-09-09): efter samlefakturaerne — KUN erhverv,
  // pilot-gated via MAANEDSRAPPORT_PILOT_CONTACTS (tom = alle). Rapport-fejl
  // må ALDRIG påvirke faktureringen, derfor egen try/catch.
  let maanedrapportOut: Awaited<ReturnType<typeof runMaanedrapporter>> | { error: string } = { sent: 0, skipped_no_email: 0, skipped_pilot: 0, failed: 0 };
  try {
    maanedrapportOut = await runMaanedrapporter(new Date());
  } catch (e) {
    maanedrapportOut = { error: e instanceof Error ? e.message : "Månedrapport-kørsel fejlede" };
  }

  return NextResponse.json({ ...result, maanedrapporter: maanedrapportOut });
}
