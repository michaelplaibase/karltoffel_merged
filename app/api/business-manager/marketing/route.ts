import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getInsights } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const blankChannel = (name: string, source: string) => ({ name, source, spend: 0, impressions: 0, clicks: 0, leads: 0, customers: 0, revenue: 0, roas: null as number | null, cpl: null as number | null, conversionRate: null as number | null, bounceRate: null as number | null });

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log ind for at se rapporten." }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Kun administratorer har adgang." }, { status: 403 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const from = req.nextUrl.searchParams.get("from") || defaultFrom;
  const to = req.nextUrl.searchParams.get("to") || today;
  const interval = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!validDate(from) || !validDate(to) || from > to || interval > 90 * 86400000) {
    return NextResponse.json({ error: "Vælg en gyldig periode på højst 90 dage." }, { status: 400 });
  }

  const channels = new Map([["Google Ads", blankChannel("Google Ads", "Google Ads API ikke tilsluttet")], ["Meta Ads", blankChannel("Meta Ads", "Meta Ads Insights")], ["Organisk / andet", blankChannel("Organisk / andet", "CRM-attribution")]]);
  const notes = ["Google Ads og GA4 er ikke forbundet til denne server.", "Meta Insights hentes live fra Karltoffel.dk-annoncekontoen; platformens rapportering kan være forsinket.", "Leads fordeles via CRM-kilden og gemte UTM-data; eksisterende leads kan mangle annonceattribution.", "ROAS/CLV kræver sikker kobling til kundeomsætning. Afvisningsprocent kræver GA4."];
  let metaLive = false;
  let metaFailed = false;

  if (process.env.META_ACCESS_TOKEN) {
    try {
      const insight = await getInsights({ objectId: process.env.META_AD_ACCOUNT_ID || "act_2067372627323557", since: from, until: to, level: "account" }) as { data?: Array<Record<string, unknown>> };
      const channel = channels.get("Meta Ads")!;
      for (const row of insight.data ?? []) {
        channel.spend += Number(row.spend) || 0;
        channel.impressions += Number(row.impressions) || 0;
        channel.clicks += Number(row.clicks) || 0;
        const actions = Array.isArray(row.actions) ? row.actions as Array<Record<string, unknown>> : [];
        const leadActionTypes = new Set(["lead", "onsite_web_lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
        channel.leads += actions.filter(a => leadActionTypes.has(String(a.action_type))).reduce((sum, a) => sum + (Number(a.value) || 0), 0);
      }
      metaLive = true;
    } catch { metaFailed = true; }
  } else {
    notes[1] = "Meta-forbindelse mangler i deploymentmiljøet; Meta Insights er derfor ikke live endnu.";
  }

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } },
    select: { status: true, source: true, utm: true, contactId: true },
  });
  for (const lead of leads) {
    const raw = `${lead.source} ${lead.utm || ""}`.toLowerCase();
    const channel = /google|adwords|gclid/.test(raw) ? channels.get("Google Ads")! : /facebook|instagram|meta|fbclid/.test(raw) ? channels.get("Meta Ads")! : channels.get("Organisk / andet")!;
    channel.leads++;
    if (lead.status === "converted" && lead.contactId) channel.customers++;
  }

  const rows = [...channels.values()];
  for (const channel of rows) {
    channel.cpl = channel.leads ? channel.spend / channel.leads : null;
    channel.conversionRate = channel.clicks ? channel.leads / channel.clicks * 100 : null;
  }
  const sum = (key: "spend" | "impressions" | "clicks" | "leads" | "customers" | "revenue") => rows.reduce((total, row) => total + row[key], 0);
  const spend = sum("spend"), clicks = sum("clicks"), leadCount = sum("leads"), revenue = sum("revenue");
  const status = metaLive ? "partial" : "demo";
  if (metaFailed) notes.push("Meta-API-kaldet fejlede; kontrollér kontoens læseadgang.");
  if (!metaLive) notes.unshift("Meta-tal mangler — annonceforbrug/kampagnedata kan ikke bekræftes som live.");
  return NextResponse.json({
    status, updatedAt: now.toISOString(), from, to, channels: rows,
    totals: { spend, impressions: sum("impressions"), clicks, leads: leadCount, customers: sum("customers"), revenue, roas: null, cpl: leadCount ? spend / leadCount : null, conversionRate: clicks ? leadCount / clicks * 100 : null, bounceRate: null },
    notes,
  }, { headers: { "Cache-Control": "no-store" } });
}
