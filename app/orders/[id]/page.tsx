import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/queries";
import { CatChip, MapLink, StatusPill, money } from "@/components/ui";

export const metadata = { title: "Rediger ordre · Karltoffel" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderDetail(Number(id));
  if (!o) notFound();
  const c = o.contact;

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Rediger ordre #{o.id}</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>Ordredetaljer, opgaver og planlægning for den enkelte ordre.</p>
        </div>
        <Link href="/orders" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h4 className="section-title">Kunde</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>{c.name}</b>{"\n"}
              {c.street}, {c.city}{"\n"}
              {c.att && c.att !== "—" ? `Att: ${c.att}\n` : ""}
              {c.phone} · {c.email}{c.cvr ? `\nCVR: ${c.cvr}` : ""}
            </div>
            <div style={{ marginTop: 10 }}><MapLink address={`${c.street}, ${c.city}`} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4 className="section-title">Ordreinfo</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>Planlagt leveringstidspunkt</b>{"\n"}{o.plannedLabel}{"\n\n"}
              <b>Ordrestatus</b>{"\n"}<span> </span>
            </div>
            <div style={{ margin: "2px 0 10px" }}><StatusPill status={o.status} /></div>
            <div className="form-static">
              <b>Kilde</b>{"\n"}{o.source}{"\n\n"}
              <b>Medarbejder</b>{"\n"}{o.employee}
              {o.comment ? `\n\nOrdrekommentar\n${o.comment}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Opgaver på ordren</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Opgavebeskrivelse</th><th>Pris (inkl. moms)</th><th>Varighed (min.)</th></tr></thead>
              <tbody>
                {o.tasks.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <CatChip category={t.category} letter={t.letter} /> {t.description}
                      {t.fromSubscription ? <div className="muted" style={{ fontSize: 12 }}>Dette er en opgave fra abonnementet</div> : null}
                    </td>
                    <td className="num">{money(t.price)}</td>
                    <td className="num">{t.durationMin}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>Sum</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(o.sumPrice)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{o.sumDuration}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Planlægning i kalender</h4></div>
        <div className="card-body tight">
          <div className="form-static">
            Fastlåst: {o.lockedFully ? "Ja, helt fastlåst" : "Nej"}{"\n"}
            Leveringsadresse: {o.deliveryAddress}
          </div>
        </div>
      </div>

      {o.addressNote ? (
        <div className="card">
          <div className="card-header"><h4 className="section-title">Adressebemærkning</h4></div>
          <div className="card-body tight"><div className="form-static">{o.addressNote}</div></div>
        </div>
      ) : null}

      <div className="savebar">
        <Link href="/orders" className="btn btn-light">Luk</Link>
        <Link href={`/orders/${o.id}/complete`} className="btn btn-primary">Afslut ordre</Link>
      </div>
    </div>
  );
}
