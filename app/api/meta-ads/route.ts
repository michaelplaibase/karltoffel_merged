// ============================================================================
// MCP server for Karl's Meta Ads (Facebook/Instagram) access — same hand-rolled
// JSON-RPC 2.0 pattern as app/api/mcp/route.ts. Wraps lib/meta-ads.ts, which
// talks directly to the Meta Marketing Graph API using the long-lived
// system-user token (env META_ACCESS_TOKEN). No self-hosted Python process,
// no Pipeboard — this replaces both.
//
// AUTH — REQUIRED ON EVERY REQUEST, same contract as app/api/mcp/route.ts.
// Set env KARL_META_ADS_MCP_TOKEN (32+ random chars). Client sends it as
// `Authorization: Bearer <token>`. Fails closed if unset.
// ============================================================================

import {
  getAdAccounts,
  getAccountInfo,
  getAccountPages,
  getCampaigns,
  getCampaignDetails,
  createCampaign,
  getAdsets,
  getAdsetDetails,
  updateAdset,
  createAdset,
  getAds,
  getAdCreatives,
  createAdCreative,
  createAd,
  getInsights,
} from "@/lib/meta-ads";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authOk(req: Request): boolean | "unconfigured" {
  const token = process.env.KARL_META_ADS_MCP_TOKEN;
  if (!token || token.length < 16) return "unconfigured";
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return safeEqual(auth.slice(7), token);
}

type JsonRpcId = string | number | null;
function rpcResult(id: JsonRpcId, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: JsonRpcId, code: number, message: string, httpStatus = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: httpStatus });
}
function toolResult(id: JsonRpcId, payload: unknown) {
  return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], isError: false });
}

type ToolDef = { description: string; inputSchema: object; handler: (args: Record<string, unknown>) => Promise<unknown> };

const TOOLS: Record<string, ToolDef> = {
  get_ad_accounts: {
    description: "Hent Meta-annoncekonti tilgængelige for brugeren.",
    inputSchema: { type: "object", properties: { userId: { type: "string" }, limit: { type: "number" } } },
    handler: (a) => getAdAccounts(a as { userId?: string; limit?: number }),
  },
  get_account_info: {
    description: "Detaljer om en specifik Meta-annoncekonto (default: Karltoffel.dk).",
    inputSchema: { type: "object", properties: { accountId: { type: "string" } } },
    handler: (a) => getAccountInfo(a as { accountId?: string }),
  },
  get_account_pages: {
    description: "Facebook-sider tilknyttet annoncekontoen (skal bruges som page_id ved kreativer).",
    inputSchema: { type: "object", properties: { accountId: { type: "string" } } },
    handler: (a) => getAccountPages(a as { accountId?: string }),
  },
  get_campaigns: {
    description: "List kampagner for annoncekontoen, evt. filtreret på status.",
    inputSchema: {
      type: "object",
      properties: { accountId: { type: "string" }, limit: { type: "number" }, statusFilter: { type: "string" } },
    },
    handler: (a) => getCampaigns(a as { accountId?: string; limit?: number; statusFilter?: string }),
  },
  get_campaign_details: {
    description: "Detaljer om en specifik kampagne.",
    inputSchema: { type: "object", required: ["campaignId"], properties: { campaignId: { type: "string" } } },
    handler: (a) => getCampaignDetails(a as { campaignId: string }),
  },
  create_campaign: {
    description:
      "Opret en ny kampagne. status default PAUSED - kampagner må ALDRIG oprettes som ACTIVE uden eksplicit godkendelse fra teamet.",
    inputSchema: {
      type: "object",
      required: ["name", "objective"],
      properties: {
        accountId: { type: "string" },
        name: { type: "string" },
        objective: {
          type: "string",
          description: "OUTCOME_AWARENESS | OUTCOME_TRAFFIC | OUTCOME_ENGAGEMENT | OUTCOME_LEADS | OUTCOME_SALES | OUTCOME_APP_PROMOTION",
        },
        status: { type: "string", description: "Default PAUSED. Skriv aldrig ACTIVE her." },
        specialAdCategories: { type: "array", items: { type: "string" } },
        dailyBudget: { type: "number", description: "Dagligt budget i øre/cents." },
        lifetimeBudget: { type: "number" },
        bidStrategy: { type: "string" },
      },
    },
    handler: (a) =>
      createCampaign(
        a as {
          accountId?: string; name: string; objective: string; status?: string;
          specialAdCategories?: string[]; dailyBudget?: number; lifetimeBudget?: number; bidStrategy?: string;
        },
      ),
  },
  get_adsets: {
    description: "List annoncesæt, evt. filtreret på kampagne.",
    inputSchema: {
      type: "object",
      properties: { accountId: { type: "string" }, limit: { type: "number" }, campaignId: { type: "string" } },
    },
    handler: (a) => getAdsets(a as { accountId?: string; limit?: number; campaignId?: string }),
  },
  get_adset_details: {
    description: "Detaljer om et specifikt annoncesæt.",
    inputSchema: { type: "object", required: ["adsetId"], properties: { adsetId: { type: "string" } } },
    handler: (a) => getAdsetDetails(a as { adsetId: string }),
  },
  update_adset: {
    description: "Opdatér destination eller status på et eksisterende annoncesæt.",
    inputSchema: {
      type: "object",
      required: ["adsetId"],
      properties: {
        adsetId: { type: "string" },
        destinationType: { type: "string", description: "fx ON_AD til Meta Instant Form." },
        status: { type: "string" },
      },
    },
    handler: (a) =>
      updateAdset(a as { adsetId: string; destinationType?: string; status?: string }),
  },
  create_adset: {
    description: "Opret et nyt annoncesæt under en kampagne. status default PAUSED.",
    inputSchema: {
      type: "object",
      required: ["campaignId", "name"],
      properties: {
        accountId: { type: "string" },
        campaignId: { type: "string" },
        name: { type: "string" },
        status: { type: "string", description: "Default PAUSED." },
        dailyBudget: { type: "string" },
        lifetimeBudget: { type: "string" },
        targeting: { type: "object", description: "fx { geo_locations, age_min, age_max, interests }" },
        optimizationGoal: { type: "string" },
        billingEvent: { type: "string" },
        bidAmount: { type: "number" },
        bidStrategy: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
        pageId: { type: "string", description: "Facebook Page ID. Kræves til Meta Instant Form lead-annoncer." },
        destinationType: { type: "string", description: "fx ON_AD til Meta Instant Form." },
      },
    },
    handler: (a) =>
      createAdset(
        a as {
          accountId?: string; campaignId: string; name: string; status?: string; dailyBudget?: string;
          lifetimeBudget?: string; targeting?: Record<string, unknown>; optimizationGoal?: string;
          billingEvent?: string; bidAmount?: number; bidStrategy?: string; startTime?: string; endTime?: string;
          pageId?: string; destinationType?: string;
        },
      ),
  },
  get_ads: {
    description: "List annoncer, evt. filtreret på kampagne eller annoncesæt.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" }, limit: { type: "number" },
        campaignId: { type: "string" }, adsetId: { type: "string" },
      },
    },
    handler: (a) => getAds(a as { accountId?: string; limit?: number; campaignId?: string; adsetId?: string }),
  },
  get_ad_creatives: {
    description: "Kreativ-detaljer for en specifik annonce.",
    inputSchema: { type: "object", required: ["adId"], properties: { adId: { type: "string" } } },
    handler: (a) => getAdCreatives(a as { adId: string }),
  },
  create_ad_creative: {
    description: "Opret et nyt kreativ (link-annonce) med tekst, billede og CTA.",
    inputSchema: {
      type: "object",
      required: ["name", "pageId", "linkUrl", "message"],
      properties: {
        accountId: { type: "string" },
        name: { type: "string" },
        imageHash: { type: "string" },
        pageId: { type: "string" },
        linkUrl: { type: "string" },
        message: { type: "string" },
        headline: { type: "string" },
        headlines: { type: "array", items: { type: "string" } },
        description: { type: "string" },
        descriptions: { type: "array", items: { type: "string" } },
        callToActionType: { type: "string", description: "fx LEARN_MORE, SIGN_UP" },
        instagramActorId: { type: "string" },
      },
    },
    handler: (a) =>
      createAdCreative(
        a as {
          accountId?: string; name: string; imageHash?: string; pageId: string; linkUrl: string; message: string;
          headline?: string; headlines?: string[]; description?: string; descriptions?: string[];
          callToActionType?: string; instagramActorId?: string;
        },
      ),
  },
  create_ad: {
    description: "Opret en annonce med et eksisterende kreativ. status default PAUSED.",
    inputSchema: {
      type: "object",
      required: ["name", "adsetId", "creativeId"],
      properties: {
        accountId: { type: "string" },
        name: { type: "string" },
        adsetId: { type: "string" },
        creativeId: { type: "string" },
        status: { type: "string", description: "Default PAUSED." },
        bidAmount: { type: "number" },
      },
    },
    handler: (a) =>
      createAd(a as { accountId?: string; name: string; adsetId: string; creativeId: string; status?: string; bidAmount?: number }),
  },
  get_insights: {
    description: "Performance-rapport (spend, klik, CPC, CTR mv.) for kampagne/annoncesæt/annonce.",
    inputSchema: {
      type: "object",
      required: ["objectId"],
      properties: {
        objectId: { type: "string", description: "Kampagne-, annoncesæt- eller annonce-ID." },
        level: { type: "string", description: "campaign | adset | ad" },
        datePreset: { type: "string", description: "fx last_7d, last_30d (default last_30d)" },
      },
    },
    handler: (a) => getInsights(a as { objectId: string; level?: string; datePreset?: string }),
  },
};

const SERVER_INFO = { name: "karltoffel-meta-ads", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-06-18";

export async function POST(req: Request) {
  const ok = authOk(req);
  if (ok === "unconfigured") return rpcError(null, -32001, "MCP not configured (KARL_META_ADS_MCP_TOKEN unset)", 503);
  if (!ok) return rpcError(null, -32000, "Unauthorized", 401);

  let body: { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> };
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error", 400); }
  const id = body.id ?? null;
  const method = body.method;
  if (!method) return rpcError(id, -32600, "Invalid Request");

  switch (method) {
    case "initialize":
      return rpcResult(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    case "ping":
      return rpcResult(id, {});
    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });
    case "tools/list":
      return rpcResult(id, {
        tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })),
      });
    case "tools/call": {
      const name = String(body.params?.name ?? "");
      const tool = TOOLS[name];
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
      const args = (body.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const result = await tool.handler(args);
        return toolResult(id, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "tool execution failed";
        return rpcResult(id, { content: [{ type: "text", text: `Fejl: ${message}` }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function GET(req: Request) {
  const ok = authOk(req);
  if (ok === "unconfigured") return rpcError(null, -32001, "MCP not configured (KARL_META_ADS_MCP_TOKEN unset)", 503);
  if (!ok) return rpcError(null, -32000, "Unauthorized", 401);
  return Response.json({ ok: true, server: SERVER_INFO, tools: Object.keys(TOOLS) });
}
