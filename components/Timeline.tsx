// Kunderejse-tidslinjen: en lodret liste af hændelser (system + noter) med
// ikon, tidsstempel og forfatter. Ren server-render — kun native <details>
// bruges til at folde "mailen kunden modtog" ud (ingen client-JS).
import type { TimelineItem } from "@/lib/timeline";

const fmt = new Intl.DateTimeFormat("da-DK", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen",
});

type EmailMeta = { to?: string; subject?: string; text?: string; simulated?: boolean };
function parseEmailMeta(meta: string | null): EmailMeta | null {
  if (!meta) return null;
  try { return JSON.parse(meta) as EmailMeta; } catch { return null; }
}

export default function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="muted" style={{ margin: 0 }}>Ingen hændelser endnu.</p>;

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((e, idx) => {
        const last = idx === items.length - 1;
        const email = e.type === "email_sent" ? parseEmailMeta(e.meta) : null;
        return (
          <li key={e.id} style={{ display: "flex", gap: 12, paddingBottom: last ? 0 : 18 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span aria-hidden style={{
                width: 30, height: 30, borderRadius: "50%", background: "#fff",
                border: `2px solid ${e.color}`, color: e.color, flex: "0 0 auto",
                display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}>
                <i className={`bi ${e.icon}`} />
              </span>
              {!last && <span style={{ flex: 1, width: 2, background: "#e5e7eb", marginTop: 4 }} />}
            </div>

            <div style={{ flex: 1, paddingTop: 2, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <b>{e.title}</b>
                <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fmt.format(e.at)}</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {e.typeLabel}{e.author ? ` · ${e.author}` : ""}
              </div>

              {e.body ? (
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{e.body}</div>
              ) : null}

              {email ? (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: "pointer" }}>
                    Vis mailen kunden modtog{email.simulated ? " (simuleret — ikke afsendt)" : ""}
                  </summary>
                  <div className="muted" style={{ fontSize: 13, margin: "8px 0 4px" }}>
                    {email.subject ? `Emne: ${email.subject}` : null}
                  </div>
                  <pre style={{
                    whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f7f7f5",
                    borderRadius: 8, padding: 12, margin: 0, fontFamily: "inherit", fontSize: 13,
                  }}>{email.text}</pre>
                </details>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
