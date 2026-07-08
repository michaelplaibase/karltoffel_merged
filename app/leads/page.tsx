import Link from "next/link";
import { prisma } from "@/lib/db";
import RowMenu, { type RowMenuItem } from "@/components/RowMenu";
import { markLeadContacted, rejectLead, convertLead } from "@/app/actions/leads";

export const metadata = { title: "Emner · Karltoffel" };

const STATUS_LABEL: Record<string, string> = { new: "Ny", contacted: "Kontaktet", converted: "Konverteret", rejected: "Afvist" };

/** Tilbudsmotor-payload på leadet (JSON blob string, se /api/leads). */
type TmPayload = {
  kundetype?: string | null;
  services?: { navn: string; qty?: number; enhed?: string; freq?: number }[];
  estimat?: { md?: number; visits?: number; count?: number };
};
function parsePayload(raw: string | null): TmPayload | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as TmPayload; } catch { return null; }
}
const DKK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const STATUS_CLASS: Record<string, string> = { new: "badge-soft-warning", contacted: "badge-soft-muted", converted: "badge-soft-success", rejected: "badge-soft-danger" };
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Alle" }, { key: "new", label: "Ny" }, { key: "contacted", label: "Kontaktet" },
  { key: "converted", label: "Konverteret" }, { key: "rejected", label: "Afvist" },
];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const active = sp.status && sp.status in STATUS_LABEL ? sp.status : "";
  const leads = await prisma.lead.findMany({
    where: active ? { status: active } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="container-1140">
      <h1 className="page-title">Emner</h1>
      <p className="page-desc">Indkomne emner fra hjemmesiden. Konvertér et emne til en kunde, når I går videre med det.</p>

      <div className="card">
        <div className="card-body">
          <div className="toolbar">
            {FILTERS.map((f) => (
              <Link key={f.key || "all"} href={f.key ? `/leads?status=${f.key}` : "/leads"}
                className={"btn btn-sm " + (active === f.key ? "btn-primary" : "btn-light")}>{f.label}</Link>
            ))}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th style={{ width: 34 }} /><th>Dato</th><th>Navn</th><th>Kontakt</th><th>Valgt pakke</th><th>Besked</th><th>Kilde</th><th>Status</th></tr></thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={8}><div className="table-empty">Ingen emner</div></td></tr>
                ) : leads.map((l) => {
                  const tm = parsePayload(l.payload);
                  const items: RowMenuItem[] = [
                    { label: "Åbn emne", href: `/leads/${l.id}` },
                    ...(l.contactId ? [{ label: "Vis kunde", href: `/customers/${l.contactId}` }] : []),
                    ...(l.status !== "converted"
                      ? [{ label: "Markér som kontaktet", action: markLeadContacted.bind(null, l.id) }]
                      : []),
                    ...(l.status !== "converted"
                      ? [{
                          label: l.contactId ? "Åbn som kunde" : "Konvertér til kunde…",
                          action: convertLead.bind(null, l.id),
                          confirm: { title: "Konvertér emne", body: `Opret ${l.name} som kunde ud fra dette emne?`, confirmLabel: "Konvertér" },
                        }]
                      : []),
                    ...(l.status !== "converted" && l.status !== "rejected"
                      ? [{
                          label: "Afvis emne…", danger: true, action: rejectLead.bind(null, l.id),
                          confirm: { title: "Afvis emne", body: `Afvis emnet fra ${l.name}?`, confirmLabel: "Afvis emne" },
                        }]
                      : []),
                  ];
                  return (
                    <tr key={l.id}>
                      <td>{items.length ? <RowMenu items={items} /> : null}</td>
                      <td className="num">{l.createdAt.toISOString().slice(0, 10)}</td>
                      <td>
                        <Link href={`/leads/${l.id}`}>{l.name}</Link>
                        {l.contactId ? <span className="badge badge-soft-muted" style={{ marginLeft: 6 }}>eksisterende kunde</span> : null}
                        {tm?.kundetype === "erhverv" ? <span className="badge badge-soft-warning" style={{ marginLeft: 6 }}>Erhverv</span> : null}
                      </td>
                      <td>{[l.email, l.phone].filter(Boolean).join(" · ") || "—"}</td>
                      <td>
                        {tm?.services?.length ? (
                          <details>
                            <summary style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                              {tm.services.length} opgaver{tm.estimat?.md ? ` · ~${DKK.format(tm.estimat.md)} kr/md` : ""}
                            </summary>
                            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                              {tm.services.map((s, i) => (
                                <li key={i}>
                                  {s.navn}
                                  {s.qty ? ` — ${DKK.format(s.qty)} ${s.enhed ?? ""}` : ""}
                                  {s.freq ? ` × ${s.freq}/år` : ""}
                                </li>
                              ))}
                            </ul>
                            {tm.estimat?.visits ? <div style={{ marginTop: 4, opacity: 0.7 }}>{tm.estimat.visits} besøg/år</div> : null}
                          </details>
                        ) : "—"}
                      </td>
                      <td>{l.message ? (l.message.length > 60 ? l.message.slice(0, 60) + "…" : l.message) : "—"}</td>
                      <td>{l.source}</td>
                      <td><span className={"badge " + (STATUS_CLASS[l.status] ?? "badge-soft-muted")}>{STATUS_LABEL[l.status] ?? l.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
