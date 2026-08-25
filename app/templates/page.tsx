import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { TEMPLATES } from "@/lib/templates-config";

export const metadata = { title: "E-mail og SMS skabeloner · Karltoffel" };

export default async function TemplatesPage() {
  // Skabelonerne bruges i rigtige kundemails (fx tilbud) — kun administratorer
  // må redigere dem (samme afgrænsning som /users; saveTemplate kræver også admin).
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 860 }}>
        <div className="card">
          <div className="card-body">
            <h1 className="page-title">E-mail og SMS skabeloner</h1>
            <div className="table-empty">Kun administratorer har adgang til skabelonerne.</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="container-1140" style={{ maxWidth: 860 }}>
      <h1 className="page-title">E-mail og SMS skabeloner</h1>
      <p className="page-desc">Tilpas teksten i de notifikationer, bekræftelser og beskeder, der sendes til dine kunder.</p>
      <div className="card">
        <div className="card-body" style={{ paddingTop: 10, paddingBottom: 10 }}>
          {TEMPLATES.map((t) => (
            <Link
              key={t.key}
              href={`/templates/${t.key}`}
              className="stack"
              style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--line2)", color: "var(--ink)", textDecoration: "none" }}
            >
              <div>
                <b style={{ fontWeight: 500 }}>{t.menuLabel}</b>
                <div className="muted" style={{ fontSize: 12.5 }}>{t.heading}</div>
              </div>
              <span className={`badge ${t.editable ? "badge-soft-success" : "badge-soft-muted"}`}>
                {t.editable ? "redigerbar" : t.delegatesTo ? `styres i ${t.delegatesTo}` : "fast tekst"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
