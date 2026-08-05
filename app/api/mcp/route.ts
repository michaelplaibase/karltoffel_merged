// ============================================================================
// MCP server for Karl (the AI operator) — minimal JSON-RPC 2.0 over HTTP POST.
//
// Why hand-rolled instead of the `mcp-handler` npm package: this repo keeps a
// deliberately tiny, SDK-free dependency list (see lib/email.ts / lib/gcal.ts),
// and MCP's core wire format is just JSON-RPC 2.0. This route implements exactly
// the methods a stateless HTTP MCP client needs — initialize, tools/list,
// tools/call (+ ping / notifications) — with no streaming/SSE, which is fine for
// Vercel serverless. If richer transport is ever needed, swap this for
// `mcp-handler` at app/api/mcp/[transport]/route.ts without touching lib/*.
//
// AUTH — REQUIRED ON EVERY REQUEST.
// Set env KARL_MCP_TOKEN (32+ random chars, e.g. `openssl rand -hex 32`). The
// client must send it as `Authorization: Bearer <KARL_MCP_TOKEN>`. The token is
// compared in CONSTANT TIME (same safeEqual idiom as app/api/plan/route.ts).
// Fails CLOSED: if KARL_MCP_TOKEN is unset the route answers 503 and never runs
// a tool. No secrets are hardcoded.
// ============================================================================

import {
  listAvailability,
  createBookingTool,
  getCustomer,
  sendConfirmation,
  listLeads,
  serviceStats,
  dailyOverview,
  draftLeadQuote,
  sendLeadQuote,
} from "@/lib/mcp-tools";

export const runtime = "nodejs";

/** Constant-time string compare (avoids leaking the token via compare timing). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authOk(req: Request): boolean | "unconfigured" {
  const token = process.env.KARL_MCP_TOKEN;
  if (!token || token.length < 16) return "unconfigured";
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return safeEqual(auth.slice(7), token);
}

// ---- JSON-RPC helpers ------------------------------------------------------
type JsonRpcId = string | number | null;
function rpcResult(id: JsonRpcId, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: JsonRpcId, code: number, message: string, httpStatus = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: httpStatus });
}
/** MCP tools/call results wrap content blocks; we return the payload as JSON text. */
function toolResult(id: JsonRpcId, payload: unknown) {
  return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], isError: false });
}

// ---- Tool registry (name → schema + handler) -------------------------------
type ToolDef = { description: string; inputSchema: object; handler: (args: Record<string, unknown>) => Promise<unknown> };

const TOOLS: Record<string, ToolDef> = {
  list_availability: {
    description: "Find den første ledige arbejdstid (07:00–15:00) for en eller alle håndværkere, givet en varighed i minutter. Bruges før en booking.",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "number", description: "Medarbejder-id. Udelad for at tjekke alle aktive håndværkere." },
        durationMin: { type: "number", description: "Estimeret varighed i minutter (default 60)." },
        fromDate: { type: "string", description: "Tidligste dato (YYYY-MM-DD). Default i dag." },
      },
    },
    handler: (a) => listAvailability(a as { employeeId?: number; durationMin?: number; fromDate?: string }),
  },
  create_booking: {
    description: "Opret en manuel ordre (booking) tildelt en håndværker, med kunde, adresse, opgaver og pris. Bruger booking-motoren; hvis dato udelades vælges første ledige slot. Estimerede varigheder flags som 'skal bekræftes'.",
    inputSchema: {
      type: "object",
      required: ["employeeId", "taskLines"],
      properties: {
        employeeId: { type: "number" },
        contactId: { type: "number", description: "Eksisterende kunde-id. Ellers angiv newContact." },
        newContact: {
          type: "object",
          properties: {
            name: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
            address: { type: "string", description: "'Vej 4, 8660 By'" },
          },
          required: ["name", "address"],
        },
        deliveryAddress: { type: "string", description: "Overstyr leveringsadresse (default kundens)." },
        taskLines: {
          type: "array",
          items: {
            type: "object",
            required: ["description"],
            properties: {
              description: { type: "string" }, category: { type: "string" },
              price: { type: "number", description: "kr inkl. moms" },
              durationMin: { type: "number", description: "Angiv hvis kendt; ellers estimeres den." },
            },
          },
        },
        plannedDate: { type: "string", description: "YYYY-MM-DD. Udelad for første ledige slot." },
        comment: { type: "string" },
      },
    },
    handler: (a) => createBookingTool(a as Parameters<typeof createBookingTool>[0]),
  },
  get_customer: {
    description: "Slå en kunde op på navn, telefon eller e-mail. Returnerer kontaktinfo + seneste ordrer.",
    inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string" } } },
    handler: (a) => getCustomer(a as { query: string }),
  },
  send_confirmation: {
    description: "Send booking-bekræftelse til kunden på en ordre (fra den tildelte håndværkers navn/reply-to).",
    inputSchema: { type: "object", required: ["orderId"], properties: { orderId: { type: "number" } } },
    handler: (a) => sendConfirmation(a as { orderId: number }),
  },
  daily_overview: {
    description: "Morgenbriefing: nye leads i går vs. dagen før og samme ugedag sidste uge, ugetotal, mest/mindst valgte services, needs-action (ubesvarede leads, gået-i-stå tilbud, kalenderhuller) samt upsell/retention-kandidater.",
    inputSchema: { type: "object", properties: { refDate: { type: "string", description: "YYYY-MM-DD (default i dag)." } } },
    handler: (a) => dailyOverview(a as { refDate?: string }),
  },
  list_leads: {
    description: "List leads, evt. filtreret på status (new|contacted|converted|rejected).",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" }, limit: { type: "number", description: "1–100 (default 25)." } },
    },
    handler: (a) => listLeads(a as { status?: string; limit?: number }),
  },
  service_stats: {
    description: "Mest/mindst valgte services fra tilbudsmotorens leads + leverede opgaver over et vindue (dage).",
    inputSchema: { type: "object", properties: { days: { type: "number", description: "Vindue i dage (default 90)." } } },
    handler: (a) => serviceStats(a as { days?: number }),
  },
  draft_lead_quote: {
    description: "Byg et tilbud-udkast (til/emne/besked) for et lead ud fra tilbudsmotorens payload og 'tilbud'-skabelonen. Brug FØR send_lead_quote — udkastet skal godkendes af Michael i Slack først.",
    inputSchema: { type: "object", required: ["leadId"], properties: { leadId: { type: "number" } } },
    handler: (a) => draftLeadQuote(a as { leadId: number }),
  },
  send_lead_quote: {
    description: "Send det godkendte tilbud til et lead og markér det 'contacted'. Kald ALDRIG uden forudgående eksplicit godkendelse fra Michael i Slack.",
    inputSchema: {
      type: "object",
      required: ["leadId", "subject", "body"],
      properties: {
        leadId: { type: "number" },
        subject: { type: "string" },
        body: { type: "string" },
        to: { type: "string", description: "Overstyr modtager-e-mail (default leadets egen)." },
        html: { type: "string", description: "Den brandede HTML-version fra draft_lead_quote. Udelades den, gendannes den automatisk." },
      },
    },
    handler: (a) => sendLeadQuote(a as { leadId: number; subject: string; body: string; to?: string; html?: string }),
  },
};

const SERVER_INFO = { name: "karltoffel-crm", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-06-18";

// ---- HTTP handlers ---------------------------------------------------------
export async function POST(req: Request) {
  const ok = authOk(req);
  if (ok === "unconfigured") return rpcError(null, -32001, "MCP not configured (KARL_MCP_TOKEN unset)", 503);
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
      // Notifications carry no id and expect no response body.
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
        // Tool-level error: report inside the result so the model can react.
        return rpcResult(id, { content: [{ type: "text", text: `Fejl: ${message}` }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// GET is a lightweight liveness/auth probe (still token-gated).
export async function GET(req: Request) {
  const ok = authOk(req);
  if (ok === "unconfigured") return rpcError(null, -32001, "MCP not configured (KARL_MCP_TOKEN unset)", 503);
  if (!ok) return rpcError(null, -32000, "Unauthorized", 401);
  return Response.json({ ok: true, server: SERVER_INFO, tools: Object.keys(TOOLS) });
}
