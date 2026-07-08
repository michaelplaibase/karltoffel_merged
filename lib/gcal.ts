// Google Calendar-booking via en service-konto — ren REST + node:crypto-JWT,
// intet SDK (samme bevidst dependency-frie mønster som lib/email.ts).
//
// Dry-run by default: er GOOGLE_SA_EMAIL / GOOGLE_SA_KEY / GCAL_CALENDAR_ID
// ikke sat, logges der og returneres { ok:true, simulated:true } — intet
// bookes, før nøglerne er konfigureret på Vercel.
//
// Bruges af lead-webhooken: hvert nyt lead booker et 15-minutters
// "Ring til kunden"-slot i den fælles kalender, hurtigst muligt:
// næste kvarter mindst 15 min ude (lead 15:00 → slot 15:15), inden for
// åbningstid 08–17 Europe/Copenhagen; ellers næste hverdag 08:15.
import { createSign } from "node:crypto";

export type CallSlot = { start: string; end: string }; // vægur-tid "YYYY-MM-DDTHH:mm:00" i Europe/Copenhagen
export type BookResult = { ok: boolean; simulated?: boolean; eventId?: string; htmlLink?: string; slot: CallSlot; error?: string };

const TZ = "Europe/Copenhagen";
const OPEN_H = 8;            // første slot: 08:15 (kvarter efter åbning)
const LAST_START_H = 16, LAST_START_M = 45; // sidste 15-min slot slutter 17:00

/** Københavnsk vægur-tid for et UTC-instant. */
function cphParts(now: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? "0");
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Næste opkalds-slot (ren funktion, så reglen kan testes uden Google).
 *  Regel: nu + 15 min, rundet OP til nærmeste kvarter; klippes til hverdage
 *  08:15–16:45 (før åbning → 08:15 samme dag; efter → næste hverdag 08:15). */
export function nextCallSlot(now: Date): CallSlot {
  const p = cphParts(now);
  // Dag-tæller i UTC-middag (immun over for DST) — vægur-datoen ruller vi selv.
  let day = Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0);
  let minutes = p.h * 60 + p.mi + 15;               // 15 min buffer
  minutes = Math.ceil(minutes / 15) * 15;           // rund op til kvarter

  const openMin = OPEN_H * 60 + 15;                 // 08:15
  const lastMin = LAST_START_H * 60 + LAST_START_M; // 16:45
  if (minutes < openMin) minutes = openMin;
  if (minutes > lastMin) { day += 86_400_000; minutes = openMin; } // næste dag 08:15
  // Weekend → mandag 08:15 (getUTCDay: 0=søn, 6=lør)
  while ([0, 6].includes(new Date(day).getUTCDay())) { day += 86_400_000; minutes = openMin; }

  const d = new Date(day);
  const stamp = (min: number) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`;
  return { start: stamp(minutes), end: stamp(minutes + 15) };
}

/** OAuth2 access token for service-kontoen (RS256-signeret JWT bearer grant). */
async function accessToken(saEmail: string, saKey: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) + "." +
    b64({ iss: saEmail, scope: "https://www.googleapis.com/auth/calendar.events", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
  // Nøglen ligger typisk i Vercel med \n som escape — fold den ud til rigtig PEM.
  const pem = saKey.replace(/\\n/g, "\n");
  const sig = createSign("RSA-SHA256").update(unsigned).sign(pem).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    signal: AbortSignal.timeout(4000), // opkaldet ligger på lead-webhookens kritiske vej — bind ventetiden
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token-svar uden access_token");
  return data.access_token;
}

/** Book et 15-min opkalds-event i den fælles kalender. Fejler aldrig hårdt —
 *  kalder man uden konfiguration, dry-runner den (leadet må ALDRIG tabes på
 *  en kalenderfejl; håndtér error-feltet hos kalderen). */
export async function bookCallEvent(input: { summary: string; description: string; now?: Date }): Promise<BookResult> {
  const slot = nextCallSlot(input.now ?? new Date());
  const saEmail = process.env.GOOGLE_SA_EMAIL;
  const saKey = process.env.GOOGLE_SA_KEY;
  const calId = process.env.GCAL_CALENDAR_ID;

  if (!saEmail || !saKey || !calId) {
    console.log(`[gcal:dry-run] ${slot.start} "${input.summary}"`);
    return { ok: true, simulated: true, slot };
  }

  try {
    const token = await accessToken(saEmail, saKey);
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(5000), // som ovenfor: bind kalender-kaldet så webhooken ikke hænger
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: slot.start, timeZone: TZ },
        end: { dateTime: slot.end, timeZone: TZ },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 5 }] },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, slot, error: `Google Calendar ${res.status}: ${detail}`.slice(0, 300) };
    }
    const ev = (await res.json().catch(() => ({}))) as { id?: string; htmlLink?: string };
    return { ok: true, eventId: ev.id, htmlLink: ev.htmlLink, slot };
  } catch (e) {
    return { ok: false, slot, error: e instanceof Error ? e.message : "kalender-booking fejlede" };
  }
}
