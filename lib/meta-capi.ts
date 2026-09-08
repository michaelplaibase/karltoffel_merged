// Meta Conversions API (CAPI) — server-side Lead-events med deduplikation.
//
// DEduplikation: browser-pixelens fbq('track','Lead',{...},{eventID: id}) og
// dette server-kald skal bruge SAMME event_id + event_name + content_name, så
// Meta tæller konverteringen én gang (se Meta Events Manager > Overview >
// Event Deduplication). event_id genereres i browseren og sendes med i
// lead-payloaden (feltet `meta_capi`) — serveren stoler på den som ren
// korrelationsnøgle; alt andet valideres her.
//
// TOKEN: access_token læses fra env META_CAPI_TOKEN (sættes på Vercel-projektet
// 'karltoffel-crm'). Den må ALDRIG ligge i site/-HTML/JS eller i klientbundt —
// denne fil bruges kun server-side (Next.js route handlers).
//
// FIRE-AND-FORGET-KONTRAKT: en CAPI-fejl må ALDRIG vælte lead-indtagelsen.
// sendMetaLead kaster aldrig — alt i try/catch, fejl logges kun til console.

const PIXEL_ID = "1574687980856727";
const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`;

export type MetaLeadInput = {
  /** Dedup-nøgle — SKAL matche browser-pixelens eventID. */
  eventId?: unknown;
  /** Unikt formularnavn, fx 'tilbudsmotor-forside' eller 'gavekort-bestilling'. */
  contentName?: unknown;
  /** Konverteringsværdi (heltal, DKK) — valgfrit. */
  value?: unknown;
  /** Request-URL til event_source_url. */
  sourceUrl?: string | null;
  /** Kundens IP (x-forwarded-for) og user-agent. */
  clientIp?: string | null;
  clientUserAgent?: string | null;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Sanitiserer payload-feltet fra klienten: null hvis intet brugbart event_id.
 *  `key` er payload-feltnavnet: 'meta_capi' (denne indsendelse) eller
 *  'meta_capi_prior' (hero-/landingformular, hvis event blev skudt ved klik på
 *  service-/landingssiden og fragtes videre via sessionStorage). */
export function parseMetaLead(body: Record<string, unknown>, key = "meta_capi"): { eventId: string; contentName: string } | null {
  const m = body[key] && typeof body[key] === "object" ? (body[key] as Record<string, unknown>) : null;
  if (!m) return null;
  // UUID eller mindst 8 tegn af [A-Za-z0-9-] — Meta accepterer vilkårlige
  // strenge, men vi klipper hårdt så graf-kaldet aldrig får skrald med.
  const eventId = str(m.event_id, 64).replace(/[^A-Za-z0-9_-]/g, "");
  const contentName = str(m.content_name, 120);
  if (!eventId || !contentName) return null;
  return { eventId, contentName };
}

/** Sender ét 'Lead'-event til Meta CAPI. Kaster ALDRIG; returnerer kort
 *  status-streng til logging. Ukendt/fejlkonfigureret token: 'skipped'. */
export async function sendMetaLead(input: MetaLeadInput): Promise<string> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return "skipped: no META_CAPI_TOKEN";
  const eventId = str(input.eventId, 64);
  const contentName = str(input.contentName, 120);
  if (!eventId || !contentName) return "skipped: missing event_id/content_name";

  const event: Record<string, unknown> = {
    event_name: "Lead",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: {
      // Kun ikke-PII signaler: IP + UA fra requesten. Hashet e-mail/tlf er en
      // senere forbedring (kræver SHA-256 af leadets kontaktfelter).
      ...(input.clientIp ? { client_ip_address: input.clientIp } : {}),
      ...(input.clientUserAgent ? { client_user_agent: input.clientUserAgent } : {}),
    },
    custom_data: {
      content_name: contentName,
      content_type: "form",
      currency: "DKK",
      ...(typeof input.value === "number" && Number.isFinite(input.value) && input.value >= 0
        ? { value: Math.round(input.value) }
        : {}),
    },
    ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
  };

  try {
    // AbortController så et hængende graf-kald aldrig blokerer ruten i mere
    // end 3s (Vercel serverless — leadet skal afleveres hurtigt).
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3_000);
    try {
      const res = await fetch(GRAPH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: token, data: [event], test_event_code: process.env.META_CAPI_TEST_EVENT_CODE || undefined }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[meta-capi] Graph ${res.status} for event ${eventId}: ${detail.slice(0, 300)}`);
        return `failed: ${res.status}`;
      }
      return "sent";
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error(`[meta-capi] exception for event ${eventId}:`, e);
    return "failed";
  }
}
