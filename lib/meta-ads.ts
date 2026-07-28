// ============================================================================
// Meta Marketing API client — thin wrapper for Karl's meta-ads MCP tool.
// Uses the long-lived Meta system-user token (env META_ACCESS_TOKEN), the
// same token already granted ads_management/ads_read on the Karltoffel.dk
// business (see karltoffel/CREDENTIALS.md). Plain fetch, no SDK, matching the
// rest of this repo's style (lib/mcp-tools.ts, lib/email.ts).
// ============================================================================

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function accessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set");
  return token;
}

function defaultAccountId(): string {
  return process.env.META_AD_ACCOUNT_ID || "act_2067372627323557";
}

async function graphFetch(path: string, params: Record<string, unknown> = {}, method: "GET" | "POST" | "DELETE" = "GET") {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  const token = accessToken();

  if (method === "GET") {
    url.searchParams.set("access_token", token);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok) {
      const details = json?.error ? JSON.stringify(json.error) : `Graph API error (${res.status})`;
      throw new Error(details);
    }
    return json;
  }

  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    body.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const res = await fetch(url.toString(), { method, body });
  const json = await res.json();
  if (!res.ok) {
    const details = json?.error ? JSON.stringify(json.error) : `Graph API error (${res.status})`;
    throw new Error(details);
  }
  return json;
}

export async function getAdAccounts(a: { userId?: string; limit?: number }) {
  return graphFetch(`${a.userId || "me"}/adaccounts`, {
    fields: "id,name,account_id,account_status,amount_spent,balance,currency",
    limit: a.limit ?? 25,
  });
}

export async function getAccountInfo(a: { accountId?: string }) {
  const accountId = a.accountId || defaultAccountId();
  return graphFetch(accountId, {
    fields: "id,name,account_id,account_status,amount_spent,balance,currency,timezone_name",
  });
}

export async function getAccountPages(a: { accountId?: string }) {
  const accountId = a.accountId || defaultAccountId();
  return graphFetch(`${accountId}/promote_pages`, { fields: "id,name" });
}

export async function getPageLeadForms(a: { pageId: string; limit?: number }) {
  return graphFetch(`${a.pageId}/leadgen_forms`, {
    fields: "id,name,status,locale,created_time",
    limit: a.limit ?? 25,
  });
}

export async function getCampaigns(a: { accountId?: string; limit?: number; statusFilter?: string }) {
  const accountId = a.accountId || defaultAccountId();
  const filtering = a.statusFilter
    ? [{ field: "effective_status", operator: "IN", value: [a.statusFilter] }]
    : undefined;
  return graphFetch(`${accountId}/campaigns`, {
    fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,created_time",
    limit: a.limit ?? 10,
    filtering,
  });
}

export async function getCampaignDetails(a: { campaignId: string }) {
  return graphFetch(a.campaignId, {
    fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,special_ad_categories,created_time,start_time,stop_time",
  });
}

export async function createCampaign(a: {
  accountId?: string;
  name: string;
  objective: string;
  status?: string;
  specialAdCategories?: string[];
  dailyBudget?: number;
  lifetimeBudget?: number;
  bidStrategy?: string;
}) {
  const accountId = a.accountId || defaultAccountId();
  return graphFetch(
    `${accountId}/campaigns`,
    {
      name: a.name,
      objective: a.objective,
      status: a.status || "PAUSED",
      special_ad_categories: a.specialAdCategories ?? [],
      daily_budget: a.dailyBudget,
      lifetime_budget: a.lifetimeBudget,
      bid_strategy: a.bidStrategy,
      buying_type: "AUCTION",
    },
    "POST",
  );
}

export async function getAdsets(a: { accountId?: string; limit?: number; campaignId?: string }) {
  const accountId = a.accountId || defaultAccountId();
  const path = a.campaignId ? `${a.campaignId}/adsets` : `${accountId}/adsets`;
  return graphFetch(path, {
    fields: "id,name,status,effective_status,daily_budget,lifetime_budget,campaign_id,targeting",
    limit: a.limit ?? 10,
  });
}

export async function getAdsetDetails(a: { adsetId: string }) {
  return graphFetch(a.adsetId, {
    fields: "id,name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,bid_strategy,destination_type,promoted_object",
  });
}

export async function updateAdset(a: {
  adsetId: string;
  destinationType?: string;
  status?: string;
}) {
  return graphFetch(
    a.adsetId,
    {
      destination_type: a.destinationType,
      status: a.status,
    },
    "POST",
  );
}

export async function createAdset(a: {
  accountId?: string;
  campaignId: string;
  name: string;
  status?: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  targeting?: Record<string, unknown>;
  optimizationGoal?: string;
  billingEvent?: string;
  bidAmount?: number;
  bidStrategy?: string;
  startTime?: string;
  endTime?: string;
  pageId?: string;
  destinationType?: string;
}) {
  const accountId = a.accountId || defaultAccountId();
  return graphFetch(
    `${accountId}/adsets`,
    {
      campaign_id: a.campaignId,
      name: a.name,
      status: a.status || "PAUSED",
      daily_budget: a.dailyBudget,
      lifetime_budget: a.lifetimeBudget,
      targeting: a.targeting,
      optimization_goal: a.optimizationGoal,
      billing_event: a.billingEvent,
      bid_amount: a.bidAmount,
      bid_strategy: a.bidStrategy,
      start_time: a.startTime,
      end_time: a.endTime,
      promoted_object: a.pageId ? { page_id: a.pageId } : undefined,
      destination_type: a.destinationType,
    },
    "POST",
  );
}

export async function getAds(a: { accountId?: string; limit?: number; campaignId?: string; adsetId?: string }) {
  const accountId = a.accountId || defaultAccountId();
  const path = a.adsetId ? `${a.adsetId}/ads` : a.campaignId ? `${a.campaignId}/ads` : `${accountId}/ads`;
  return graphFetch(path, {
    fields: "id,name,status,effective_status,adset_id,campaign_id,creative",
    limit: a.limit ?? 10,
  });
}

export async function getAdCreatives(a: { adId: string }) {
  return graphFetch(`${a.adId}/adcreatives`, {
    fields: "id,name,body,title,image_url,object_story_spec",
  });
}

export async function uploadAdImageFromUrl(a: { accountId?: string; imageUrl: string; filename?: string }) {
  const accountId = a.accountId || defaultAccountId();
  const imageResponse = await fetch(a.imageUrl);
  if (!imageResponse.ok) throw new Error(`Image download failed (${imageResponse.status})`);

  const form = new FormData();
  form.set("access_token", accessToken());
  form.set(
    "filename",
    new Blob([await imageResponse.arrayBuffer()], {
      type: imageResponse.headers.get("content-type") || "image/png",
    }),
    a.filename || "creative.png",
  );

  const response = await fetch(`${GRAPH_BASE}/${accountId}/adimages`, { method: "POST", body: form });
  const json = await response.json();
  if (!response.ok) {
    const details = json?.error ? JSON.stringify(json.error) : `Graph API error (${response.status})`;
    throw new Error(details);
  }
  return json;
}

export async function createAdCreative(a: {
  accountId?: string;
  name: string;
  imageHash?: string;
  pageId: string;
  linkUrl: string;
  message: string;
  headline?: string;
  headlines?: string[];
  description?: string;
  descriptions?: string[];
  callToActionType?: string;
  formId?: string;
  instagramActorId?: string;
}) {
  const accountId = a.accountId || defaultAccountId();
  const linkData: Record<string, unknown> = {
    link: a.linkUrl,
    message: a.message,
    call_to_action: {
      type: a.callToActionType || "LEARN_MORE",
      value: a.formId ? { lead_gen_form_id: a.formId } : { link: a.linkUrl },
    },
  };
  if (a.imageHash) linkData.image_hash = a.imageHash;
  if (a.headlines) linkData.multi_share_optimized = true;
  if (a.headline) linkData.name = a.headline;
  if (a.description) linkData.link_description = a.description;

  return graphFetch(
    `${accountId}/adcreatives`,
    {
      name: a.name,
      object_story_spec: {
        page_id: a.pageId,
        instagram_actor_id: a.instagramActorId,
        link_data: linkData,
      },
    },
    "POST",
  );
}

export async function createAd(a: {
  accountId?: string;
  name: string;
  adsetId: string;
  creativeId: string;
  status?: string;
  bidAmount?: number;
}) {
  const accountId = a.accountId || defaultAccountId();
  return graphFetch(
    `${accountId}/ads`,
    {
      name: a.name,
      adset_id: a.adsetId,
      creative: { creative_id: a.creativeId },
      status: a.status || "PAUSED",
      bid_amount: a.bidAmount,
    },
    "POST",
  );
}

export async function deleteAd(a: { adId: string }) {
  return graphFetch(a.adId, {}, "DELETE");
}

export async function getInsights(a: {
  objectId: string;
  timeRange?: string;
  level?: string;
  datePreset?: string;
}) {
  return graphFetch(`${a.objectId}/insights`, {
    fields: "campaign_name,adset_name,ad_name,impressions,clicks,spend,cpc,ctr,reach,actions",
    level: a.level,
    date_preset: a.datePreset || a.timeRange || "last_30d",
  });
}
