// Tidslinje-laget: skriv hændelser (logEvent) og læs dem som view-typer
// (getLeadTimeline / getContactTimeline), så page.tsx aldrig rører Prisma-rows.
// Hændelser hænges på leadet og/eller kontakten; kundesiden viser BÅDE
// hændelser stemplet direkte på kontakten OG dem fra kontaktens emner, så hele
// kunderejsen (fra emne til kunde) står i én tidslinje.
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type LeadEventType =
  | "lead_created"
  | "lead_updated"
  | "call_booked"
  | "email_sent"
  | "note"
  | "status_changed"
  | "converted";

/** Bootstrap-ikon + accent-farve pr. type (bootstrap-icons importeres i layout). */
export const EVENT_STYLE: Record<LeadEventType, { icon: string; color: string; label: string }> = {
  lead_created:   { icon: "bi-hand-thumbs-up",  color: "#eab308", label: "Emne oprettet" },
  lead_updated:   { icon: "bi-arrow-repeat",     color: "#eab308", label: "Ny henvendelse" },
  call_booked:    { icon: "bi-telephone",        color: "#257BB6", label: "Opkald booket" },
  email_sent:     { icon: "bi-envelope",         color: "#4C3718", label: "Mail sendt" },
  note:           { icon: "bi-pencil-square",     color: "#6b7280", label: "Note" },
  status_changed: { icon: "bi-arrow-repeat",      color: "#6b7280", label: "Status ændret" },
  converted:      { icon: "bi-person-check",      color: "#16a34a", label: "Konverteret" },
};

function styleFor(type: string) {
  return EVENT_STYLE[type as LeadEventType] ?? { icon: "bi-dot", color: "#6b7280", label: type };
}

// Prisma-klient ELLER en transaktions-klient, så hændelser kan logges inde i en
// transaktion (fx sammen med konverteringen).
type Db = typeof prisma | Prisma.TransactionClient;

export type LogEventInput = {
  companyId: number;
  leadId?: number | null;
  contactId?: number | null;
  type: LeadEventType;
  title: string;
  body?: string | null;
  meta?: unknown; // objekt serialiseres til JSON-text; string bruges som den er
  authorId?: number | null;
};

export async function logEvent(db: Db, e: LogEventInput) {
  return db.leadEvent.create({
    data: {
      companyId: e.companyId,
      leadId: e.leadId ?? null,
      contactId: e.contactId ?? null,
      type: e.type,
      title: e.title,
      body: e.body ?? null,
      meta: e.meta == null ? null : typeof e.meta === "string" ? e.meta : JSON.stringify(e.meta),
      authorId: e.authorId ?? null,
    },
  });
}

/** Best-effort: en hændelses-skrivning må aldrig vælte den handling der udløste
 *  den (fx lead-oprettelse eller mail-afsendelse). Fejl logges kun. */
export async function tryLogEvent(db: Db, e: LogEventInput): Promise<void> {
  try {
    await logEvent(db, e);
  } catch (err) {
    console.error(`[timeline] kunne ikke logge '${e.type}':`, err instanceof Error ? err.message : err);
  }
}

/* ---------- Læsning → view-type ---------- */
export type TimelineItem = {
  id: number;
  type: LeadEventType | string;
  icon: string;
  color: string;
  typeLabel: string;
  title: string;
  body: string | null;
  meta: string | null; // rå JSON-text; UI'et parser kendte former (fx sendt mail)
  author: string | null; // "Fornavn Efternavn" eller null (system)
  at: Date;
};

type EventRow = Prisma.LeadEventGetPayload<{ include: { author: { select: { firstName: true; lastName: true } } } }>;

function mapEvent(e: EventRow): TimelineItem {
  const s = styleFor(e.type);
  const author = e.author ? `${e.author.firstName} ${e.author.lastName}`.trim() : null;
  return {
    id: e.id, type: e.type, icon: s.icon, color: s.color, typeLabel: s.label,
    title: e.title, body: e.body, meta: e.meta, author, at: e.createdAt,
  };
}

const AUTHOR_INCLUDE = { author: { select: { firstName: true, lastName: true } } } as const;

export async function getLeadTimeline(leadId: number): Promise<TimelineItem[]> {
  const rows = await prisma.leadEvent.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    include: AUTHOR_INCLUDE,
  });
  return rows.map(mapEvent);
}

/** Kundens tidslinje = hændelser stemplet direkte på kontakten PLUS hændelser
 *  fra kontaktens emner (som blev logget før konverteringen, uden contactId). */
export async function getContactTimeline(contactId: number): Promise<TimelineItem[]> {
  const rows = await prisma.leadEvent.findMany({
    where: { OR: [{ contactId }, { lead: { contactId } }] },
    orderBy: { createdAt: "desc" },
    include: AUTHOR_INCLUDE,
  });
  return rows.map(mapEvent);
}
