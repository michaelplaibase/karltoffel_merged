import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { getInsights } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
};
const blankChannel = (name: string, source: string) => ({
  name, source, spend: 0, impressions: 0, clicks: 0, leads: 0, customers: 0, revenue: 0,
  roas: null as number | null, cpl: null as number | null, conversionRate: null as number | null, bounceRate: null as number | null,
});

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

  const channels = [
    blankChannel("Google Ads", "Ingen Google Ads-konto tilsluttet"),
    blankChannel("Meta Ads", "Meta Ads Insights"),
  ];
  const meta = channels[1];
  const notes = [
    "Google Ads API-adgang mangler; Google Ads-data vises ikke som live-tal.",
    "GA4 mangler; afvisningsprocent kan ikke vises endnu.",
    "ROAS og CLV kræver kobling til verificeret kundeomsætning.",
  ];
  let metaLive = false;
  let metaFailed = false;

  if (process.env.META_ACCESS_TOKEN) {
    try {
      const result = await getInsights({
        objectId: process.env.META_AD_ACCOUNT_ID || "act_2067372627323557",
        since: from,
        until: to,
        level: "account",
      }) as { data?: Array<Record<string, unknown>> };
      for (const row of result.data ?? []) {
        meta.spend += Number(row.spend) || 0;
        meta.impressions += Number(row.impressions) || 0;
        meta.clicks += Number(row.clicks) || 0;
        const actions = Array.isArray(row.actions) ? row.actions as Array<Record<string, unknown>> : [];
        // Meta action types overlap; count only the canonical lead event once.
        const canonicalLead = actions.find(action => action.action_type === "lead");
        meta.leads += Number(canonicalLead?.value) || 0;
      }
      metaLive = true;
      meta.source = "Live Meta Insights — platformens lead-event";
      meta.cpl = meta.leads ? meta.spend / meta.leads : null;
      meta.conversionRate = meta.clicks ? meta.leads / meta.clicks * 100 : null;
    } catch {
      metaFailed = true;
    }
  }

  const spend = channels.reduce((sum, channel) => sum + channel.spend, 0);
  const clicks = channels.reduce((sum, channel) => sum + channel.clicks, 0);
  const leads = channels.reduce((sum, channel) => sum + channel.leads, 0);
  const status = metaLive ? "partial" : "unavailable";
  if (metaFailed) notes.unshift("Meta Ads kunne ikke hentes — kontrollér kontoens læseadgang.");
  else if (!metaLive) notes.unshift("Meta Ads-token er ikke tilgængeligt i dette miljø.");
  if (process.env.VERCEL_ENV === "preview") {
    notes.push("Preview bruger kun aggregerede annonceplatformstal; CRM-produktionsleads og kundeoplysninger læses ikke.");
  }

  return NextResponse.json({
    status,
    updatedAt: now.toISOString(),
    from,
    to,
    channels,
    totals: {
      spend,
      impressions: channels.reduce((sum, channel) => sum + channel.impressions, 0),
      clicks,
      leads,
      customers: 0,
      revenue: 0,
      roas: null,
      cpl: leads ? spend / leads : null,
      conversionRate: clicks ? leads / clicks * 100 : null,
      bounceRate: null,
    },
    notes,
  }, { headers: { "Cache-Control": "no-store" } });
}
