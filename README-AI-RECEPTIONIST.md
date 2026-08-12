# AI Receptionist — prototype

A working prototype of an "AI receptionist" for Karltoffel: a voice-capable
assistant that always "answers the phone" and can check real orders, customer
records, and calendar availability — built directly against the live CRM
(Prisma/Postgres), not mock data.

## Where it lives

- `app/ai-receptionist/page.tsx` — the demo page (nav: Hjælp → "AI Receptionist (prototype)")
- `components/ReceptionistWidget.tsx` — client UI: chat log, mic button, quick-question buttons, TTS playback
- `app/actions/receptionist.ts` — server action; calls the SAME `lib/mcp-tools.ts` functions
  (`getCustomer`, `listAvailability`) that Karl's MCP server (`app/api/mcp/route.ts`) already exposes,
  so this reads real Contact/Order/Subscription rows, not fixtures.

## How to demo it

1. Log in to the CRM portal as usual (this page sits behind the same session middleware as every other page).
2. Go to **Hjælp → AI Receptionist (prototype)**.
3. Type a real customer's name/phone/e-mail into "Kunde", then either:
   - Click one of the 5 quick-question buttons (reliable canned scenarios for a live demo), or
   - Type a free-text question in Danish or English, or
   - Click 🎤 Tal and speak (Chrome/Edge — uses `webkitSpeechRecognition`).
4. The assistant looks up the real order/booking/customer data and replies in the chat log —
   the reply is also **read aloud** via the browser's built-in `SpeechSynthesis` API (Danish or English voice,
   auto-detected from the question).

## What's real vs. what's mocked

| Piece | Status |
|---|---|
| Customer/order/subscription lookup | **Real** — reads production Prisma/Postgres via `lib/mcp-tools.ts` |
| Availability lookup | **Real** — reuses `listAvailability` (same booking engine as the calendar) |
| Intent detection (status / next visit / price / availability) | Prototype — simple keyword rules, not an LLM |
| Speech-to-text | Browser-native (`webkitSpeechRecognition`) — works in Chrome/Edge, no API key |
| Text-to-speech | Browser-native (`SpeechSynthesis`) — works everywhere, voice quality is OS-dependent |
| Real phone calls (PSTN) | **Not implemented** — by design, per spec ("skal kunne tale, men behøver ikke at kunne ringe op / ringes op") |
| Public/anonymous access | **Not implemented** — currently sits behind the same portal login as the rest of the CRM |

## Path to production

1. **Real telephony**: Twilio Voice + Twilio Media Streams (or a SIP trunk) to actually answer/place calls,
   bridging the audio stream to the STT/TTS pipeline below. This is the only genuinely new infrastructure needed.
2. **Production-grade STT**: swap `webkitSpeechRecognition` for OpenAI Whisper API or Deepgram streaming STT
   for accuracy and language robustness (Danish support is much stronger there than in browser STT).
3. **LLM reasoning layer**: replace the keyword-based `classifyIntent` in `app/actions/receptionist.ts` with an
   LLM call (already have `lib/mcp-tools.ts` as ready-made tool-calling functions — this is exactly what
   `app/api/mcp/route.ts` exposes to Karl already, so the same tool surface can be reused for a live-call agent).
4. **Production-grade TTS**: ElevenLabs or OpenAI TTS for a more natural, on-brand voice than the OS default.
5. **Public/unauthenticated entry point**: a real inbound-call flow does NOT go through the portal login —
   it needs its own caller-ID-based customer lookup + a scoped, rate-limited API path (do not expose
   `app/actions/receptionist.ts` directly to anonymous callers as-is).
6. **Booking mutations**: currently read-only (status/availability lookups). Wiring in `createBookingTool`
   (already implemented in `lib/mcp-tools.ts`) lets the assistant actually reschedule/book during a call —
   should get a confirmation step before committing, same as `send_lead_quote` requires human approval today.

## Notes

- No new dependencies were added — TTS/STT are 100% browser Web APIs.
- Type-checks clean (`npx tsc --noEmit`). Full `next build` currently fails locally only because
  `DATABASE_URL` isn't decryptable from this environment's Vercel CLI session (pre-existing issue,
  reproduces on `/account` too, unrelated to this change) — Vercel's own build pipeline has the real secret.
