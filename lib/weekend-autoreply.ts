// Approved weekend auto-reply for inbound leads. The window logic is a PURE,
// transport-free helper so it can be unit-tested deterministically; the e-mail
// body/subject are built here too and sent via lib/email.ts by the caller.
//
// Window (Europe/Copenhagen, DST-correct): Friday >= 16:00 through Monday
// < 08:00 — i.e. Fri 16:00–24:00, all of Sat, all of Sun, Mon 00:00–08:00.

/** Wall-clock weekday (0=Sun … 6=Sat) + hour/minute of `date` in Europe/Copenhagen.
 *  Uses Intl so CEST/CET (summer/winter offset) is handled by the tz database,
 *  never a hard-coded +1/+2. */
function copenhagenParts(date: Date): { weekday: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Copenhagen",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = wdMap[get("weekday")] ?? 0;
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some ICU builds emit "24" at midnight
  const minute = parseInt(get("minute"), 10);
  return { weekday, hour, minute: Number.isFinite(minute) ? minute : 0 };
}

/** True when `date` falls inside the weekend auto-reply window (Fri 16:00 →
 *  Mon 08:00, Europe/Copenhagen). */
export function isWithinWeekendWindow(date: Date): boolean {
  const { weekday, hour } = copenhagenParts(date);
  if (weekday === 6 || weekday === 0) return true;   // all Saturday, all Sunday
  if (weekday === 5) return hour >= 16;               // Friday from 16:00
  if (weekday === 1) return hour < 8;                 // Monday until 08:00
  return false;
}

/** First name for the greeting, or null if we only have whitespace/nothing.
 *  Company/lead names arrive as a single `name` field, so first word wins. */
export function firstName(name: string | null | undefined): string | null {
  const w = (name ?? "").trim().split(/\s+/)[0]?.trim();
  return w ? w : null;
}

/** Build the approved Danish auto-reply. Plain text only — lib/email.ts sends a
 *  `text` body (no HTML field), so we match that transport. */
export function buildWeekendAutoReply(name: string | null | undefined): { subject: string; text: string } {
  const fn = firstName(name);
  const greeting = fn ? `Hej ${fn},` : "Hej,";
  const subject = "Tak - vi er tilbage mandag, klar til at gøre dig til en heldig kartoffel";
  const text = [
    greeting,
    "",
    "Tak for din henvendelse - den er landet trygt hos os.",
    "",
    "Lige nu holder vores hårdtarbejdende handymænd en velfortjent weekendpause, så de er friske og stærke igen mandag morgen. Vi laver dit tilbud og vender tilbage hurtigst muligt, når vi er tilbage på pinden.",
    "",
    "Skulle det haste, er du velkommen til at skrive lidt mere om opgaven i et svar - så ligger det klar, når vi tænder for maskinerne mandag.",
    "",
    "Rigtig god weekend.",
    "",
    "Mange hilsner",
    "Karltoffel - fast hus- og haveservice til heldige kartofler",
    "22 22 38 33 · hej@karltoffel.dk",
  ].join("\n");
  return { subject, text };
}
