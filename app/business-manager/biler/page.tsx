// Business Manager — Biler: register med månedsomkostninger (CRUD via
// server-actions i app/actions/business-manager.ts). Admin-only via layoutet.
import { prisma } from "@/lib/db";
import { saveVehicle, deleteVehicle } from "@/app/actions/business-manager";
import { vehicleMonthlyCost } from "@/lib/business-manager";

export const dynamic = "force-dynamic";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default async function VehiclesPage() {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { id: "asc" } });
  const total = vehicles.filter((v) => v.active).reduce((a, v) => a + vehicleMonthlyCost(v), 0);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Biler ({vehicles.filter((v) => v.active).length} aktive) — {kr(total)} /md i alt</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th data-label="Bil">Bil</th>
                  <th data-label="Leasing/afskr.">Leasing/afskr.</th>
                  <th data-label="Forsikring">Forsikring</th>
                  <th data-label="Brændstof">Brændstof</th>
                  <th data-label="Service">Service</th>
                  <th data-label="Andet">Andet</th>
                  <th data-label="I alt/md">I alt/md</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr><td colSpan={8}><div className="table-empty">Ingen biler endnu — opret den første nedenfor. Feltbeløbene er pr. måned.</div></td></tr>
                ) : vehicles.map((v) => (
                  <tr key={v.id} style={{ opacity: v.active ? 1 : 0.5 }}>
                    <td data-label="Bil">{v.name}{!v.active ? " (inaktiv)" : ""}</td>
                    <td data-label="Leasing/afskr." className="num">{kr(v.leaseMonthly)}</td>
                    <td data-label="Forsikring" className="num">{kr(v.insuranceMonthly)}</td>
                    <td data-label="Brændstof" className="num">{kr(v.fuelMonthly)}</td>
                    <td data-label="Service" className="num">{kr(v.serviceMonthly)}</td>
                    <td data-label="Andet" className="num">{kr(v.otherMonthly)}</td>
                    <td data-label="I alt/md" className="num"><b>{kr(vehicleMonthlyCost(v))}</b></td>
                    <td>
                      <form action={deleteVehicle.bind(null, v.id)} style={{ display: "inline" }}>
                        <button className="btn btn-sm btn-light" type="submit">Slet</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Tilføj bil</h4></div>
        <div className="card-body">
          <form action={saveVehicle}>
            <div className="f2"><label>Navn</label><div><input name="name" className="form-control form-control-sm" placeholder='fx "Van 1 — Ford Transit"' required /></div></div>
            <div className="f2"><label>Leasing/afskrivning (kr/md)</label><div><input name="leaseMonthly" type="number" min="0" className="form-control form-control-sm" placeholder="fx 3500" /></div></div>
            <div className="f2"><label>Forsikring (kr/md)</label><div><input name="insuranceMonthly" type="number" min="0" className="form-control form-control-sm" placeholder="fx 600" /></div></div>
            <div className="f2"><label>Brændstof (kr/md)</label><div><input name="fuelMonthly" type="number" min="0" className="form-control form-control-sm" placeholder="fx 1800" /></div></div>
            <div className="f2"><label>Service/værksted (kr/md)</label><div><input name="serviceMonthly" type="number" min="0" className="form-control form-control-sm" placeholder="fx 400" /></div></div>
            <div className="f2"><label>Andet (kr/md)</label><div><input name="otherMonthly" type="number" min="0" className="form-control form-control-sm" placeholder="fx 150" /></div></div>
            <div className="f2"><label>Bemærkning</label><div><input name="note" className="form-control form-control-sm" /></div></div>
            <div className="f2"><label>Aktiv</label><div><label className="form-check-inline"><input type="checkbox" name="active" defaultChecked /> Bruges i beregningerne</label></div></div>
            <div className="row-actions"><button className="btn btn-primary" type="submit">Tilføj bil</button></div>
          </form>
        </div>
      </div>
    </>
  );
}
