import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { OPTIMIZATION as O } from "@/lib/funktioner";
import OptimizationRunner from "@/components/OptimizationRunner";

export const metadata = { title: "Abonnementsoptimering · Karltoffel" };

export default async function OptimizationPage() {
  // Kun administratorer — funktionssiderne er admin-only (Thomas, 2026-08-31).
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  if (!me.isAdmin) redirect("/calendar");
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="page-title" style={{ margin: 0 }}>{O.title}</h1>
        <span className="badge badge-soft-success">Aktiveret</span>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-body">
          <h4 className="section-title">Introduktion</h4>
          {O.intro.map((p, i) => <p key={i} className="muted" style={{ marginBottom: 10 }}>{p}</p>)}
        </div>
      </div>

      <OptimizationRunner dialogNote={O.dialogNote} />
    </div>
  );
}
