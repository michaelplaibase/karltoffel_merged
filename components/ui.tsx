import Link from "next/link";
import { categoryColor } from "@/lib/categories";
import type { Contact, TaskLine } from "@/lib/data";

export function CatChip({ category, letter }: { category: string; letter: string }) {
  return (
    <span className="catchip" style={{ background: categoryColor(category) }} title={`Kategori: ${category}`}>
      {letter}
    </span>
  );
}

export function MapLink({ address }: { address: string }) {
  const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return (
    <a className="maplink" href={href} target="_blank" rel="noopener noreferrer">
      <i className="bi bi-geo-alt-fill" /> Åbn i Google Maps
    </a>
  );
}

/** Normalise a stored phone number to a dialable "+…" string, or null when it is
 *  missing/undialable (fewer than 8 digits also guards masked placeholders like
 *  "+45 •• •• •• ••"). */
function telNormalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 8) return `+45${digits}`;
  if (digits.startsWith("0045")) return `+${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("45")) return `+${digits}`;
  return null;
}

export function telHref(raw: string | null | undefined): string | null {
  const n = telNormalize(raw);
  return n ? `tel:${n}` : null;
}

export function telDisplay(raw: string | null | undefined): string | null {
  const n = telNormalize(raw);
  if (!n) return null;
  const m = /^\+45(\d{8})$/.exec(n);
  return m ? `+45 ${m[1].replace(/(\d{2})(?=\d)/g, "$1 ")}` : n;
}

export function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls = s.includes("afsluttet") || s.includes("udført")
    ? "badge-soft-success"
    : s.includes("mislykk") || s.includes("fejl")
      ? "badge-soft-danger"
      : "badge-soft-warning";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function CustomerCell({ contact, withMap = true }: { contact: Contact; withMap?: boolean }) {
  return (
    <div className="cust">
      <b className="l"><Link href={`/customers/${contact.id}`} style={{ color: "inherit" }}>{contact.name}</Link></b>
      <span className="l muted">{contact.street}, {contact.city}</span>
      {contact.att && contact.att !== "—" ? <span className="l muted">Att: {contact.att}</span> : null}
      <span className="l muted">{contact.phone} · {contact.email}</span>
      {withMap ? <MapLink address={`${contact.street}, ${contact.city}`} /> : null}
    </div>
  );
}

export function TaskCell({ tasks }: { tasks: TaskLine[] }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      {tasks.map((t, i) => (
        <span key={i}>
          <CatChip category={t.category} letter={t.letter} /> {t.description}
        </span>
      ))}
    </div>
  );
}

export function money(n: number) {
  return n.toLocaleString("da-DK") + " kr";
}
