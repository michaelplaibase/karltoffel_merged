import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLeadTimeline } from "@/lib/timeline";
import SkraafotoCard from "@/components/SkraafotoCard";
import Timeline from "@/components/Timeline";
import TimelineNoteForm from "@/components/TimelineNoteForm";
import RowMenu, { type RowMenuItem } from "@/components/RowMenu";
import { MapLink } from "@/components/ui";
import { markLeadContacted, rejectLead, convertLead } from "@/app/actions/leads";

export const metadata = { title: "Emne · Karltoffel" };

// Tokenet når aldrig browseren — kaldene går gennem CRM-proxyen; her sendes kun
// en boolean, så kortet kan vise "ikke konfigureret" hvis tokenet mangler.
const SKRAAFOTO_CONFIGURED = !!(process.env.DATAFORSYNINGEN_TOKEN || "").trim();
const DKK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

const STATUS_LABEL: Record<string, string> = { new: "Ny", contacted: "Kontaktet", converted: "Konverteret", rejected: "Afvist" };
const STATUS_CLASS: Record<string, string> = { new: "badge-soft-warning", contacted: "badge-soft-muted", converted: "badge-soft-success", rejected: "badge-soft-danger" };

type TmPayload = {
  kundetype?: string | null;
  services?: { navn: string; qty?: number; enhed?: string; freq?: number; pris?: number | null; pakke?: boolean }[];
  estimat?: { md?: number; aar?: number; visits?: number; count?: number };
};
function parsePayload(raw: string | null): TmPayload | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as TmPayload; } catch { return null; }
}

function serviceDetalje(s: { qty?: number; enhed?: string; freq?: number; pris?: number | null; pakke?: boolean }): string {
  const freq = Math.max(1, Math.round(Number(s.freq) || 1));
  const qty = Math.round(Number(s.qty) || 0);
  const enhed = (s.enhed || "").trim();
  if (s.pris == null) return s.pakke ? "indeholdt i pakken" : "pris ved besøg";
  if (!qty) return "pris efter antal";
  return `${qty ? `${DKK.format(qty)} ${enhed} · ` : ""}${freq}× om året`;
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) notFound();

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();

  const events = await getLeadTimeline(leadId);
  const tm = parsePayload(lead.payload);
  const kt = tm?.kundetype === "erhverv" ? "Erhverv" : tm?.kundetype === "privat" ? "Privat" : null;

  const actions: RowMenuItem[] = [
    ...(lead.contactId ? [{ label: "Vis kunde", href: `/customers/${lead.contactId}` }] : []),
    ...(lead.status !== "converted" ? [{ label: "Markér som kontaktet", action: markLeadContacted.bind(null, lead.id) }] : []),
    ...(lead.status !== "converted" ? [{
      label: lead.contactId ? "Åbn som kunde" : "Konvertér til kunde…",
      action: convertLead.bind(null, lead.id),
      confirm: { title: "Konvertér emne", body: `Opret ${lead.name} som kunde ud fra dette emne?`, confirmLabel: "Konvertér" },
    }] : []),
    ...(lead.status !== "converted" && lead.status !== "rejected" ? [{
      label: "Afvis emne…", danger: true, action: rejectLead.bind(null, lead.id),
      confirm: { title: "Afvis emne", body: `Afvis emnet fra ${lead.name}?`, confirmLabel: "Afvis emne" },
    }] : []),
  ];

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Emne-detaljer</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            Alt kunden har oplyst via tilbudsmotoren, matriklen, og hele forløbet i kunderejsen.
          </p>
        </div>
        <div className="row-actions">
          {actions.length ? <RowMenu items={actions} /> : null}
          <Link href="/leads" className="btn btn-light">Gå tilbage</Link>
        </div>
      </div>

      {/* Lead-kort: alle kundens oplysninger */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 className="section-title">Lead-kort</h4>
          <span className={"badge " + (STATUS_CLASS[lead.status] ?? "badge-soft-muted")}>{STATUS_LABEL[lead.status] ?? lead.status}</span>
        </div>
        <div className="card-body tight">
          <div className="grid-2">
            <div>
              <div className="form-static">
                <b>{lead.name}</b>{kt ? `  ·  ${kt}` : ""}{"\n"}
                {[lead.email, lead.phone].filter(Boolean).join(" · ") || "Ingen kontaktinfo"}{"\n"}
                {lead.address || "Ingen adresse oplyst"}
              </div>
              {lead.address ? <div style={{ marginTop: 10 }}><MapLink address={lead.address} /></div> : null}
              <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                Modtaget {lead.createdAt.toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" })} · Kilde: {lead.source}
                {lead.contactId ? " · eksisterende kunde" : ""}
              </div>
              {lead.message ? (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 13 }}>Besked fra kunden</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{lead.message}</div>
                </div>
              ) : null}
            </div>

            <div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Ønskede ydelser</div>
              {tm?.services?.length ? (
                <>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {tm.services.map((s, i) => (
                      <li key={i}>{s.navn} <span className="muted">— {serviceDetalje(s)}</span></li>
                    ))}
                  </ul>
                  {tm.estimat?.md ? (
                    <div style={{ marginTop: 10 }}>Estimat: <b>~{DKK.format(tm.estimat.md)} kr/md</b>{tm.estimat.visits ? ` · ${tm.estimat.visits} besøg/år` : ""}</div>
                  ) : null}
                </>
              ) : <p className="muted" style={{ margin: 0 }}>Ingen ydelser valgt.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Matrikel-billede fra tilbudsmotoren (genereres fra adressen) */}
      {lead.address ? <SkraafotoCard address={lead.address} configured={SKRAAFOTO_CONFIGURED} showMeasurements={false} /> : null}

      {/* Tidslinje / kunderejse */}
      <div className="card">
        <div className="card-header"><h4 className="section-title">Tidslinje</h4></div>
        <div className="card-body tight">
          <TimelineNoteForm leadId={lead.id} contactId={lead.contactId ?? undefined} />
          <Timeline items={events} />
        </div>
      </div>
    </div>
  );
}
