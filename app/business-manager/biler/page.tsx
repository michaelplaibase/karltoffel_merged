// Business Manager — Biler: register med månedsomkostninger, tildeling til en
// medarbejder (bilens udgifter myntes på vedkommende i kalkulatoren) og
// redigering. CRUD via server-actions i app/actions/business-manager.ts.
import { prisma } from "@/lib/db";
import { saveVehicle, deleteVehicle } from "@/app/actions/business-manager";
import { vehicleMonthlyCost } from "@/lib/business-manager";
import Link from "next/link";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const sp = await searchParams;
  const editId = Number(sp.edit) || 0;
  const [vehicles, users] = await Promise.all([
    prisma.vehicle.findMany({ orderBy: { id: "asc" }, include: { assignedTo: { select: { firstName: true, lastName: true } } } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
  ]);
  const editing = editId > 0 ? vehicles.find((v) => v.id === editId) ?? null : null;
  const active = vehicles.filter((v) => v.active);
  const total = active.reduce((a, v) => a + vehicleMonthlyCost(v), 0);
  const userOptions = (selected: number | null) => (
    <>
      <option value="">— Fordel på alle —</option>
      {users.map((u) => (
        <option key={u.id} value={u.id} selected={selected === u.id}>
          {`${u.firstName} ${u.lastName}`.trim()}
        </option>
      ))}
    </>
  );

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Biler ({active.length} aktive) — {kr(total)} /md i alt</h4></div>
        <div className="card-body tight">
          <p className="page-desc" style={{ marginBottom: 8 }}>
            En bil kan tildelles én medarbejder — så lægges bilens udgifter ind i netop den
            medarbejders kostpris. Biler uden tildeling tæller ikke i nogen medarbejders tal
            (medarbejdere uden bil står med 0 kr), men de tæller med i flåde-totalen øverst.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th data-label="Bil">Bil</th>
                  <th data-label="Tildelt">Tildelt</th>
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
                  <tr><td colSpan={9}><div className="table-empty">Ingen biler endnu — opret den første nedenfor. Feltbeløbene er pr. måned.</div></td></tr>
                ) : vehicles.map((v) => (
                  <tr key={v.id} style={{ opacity: v.active ? 1 : 0.5 }}>
                    <td data-label="Bil">{v.name}{!v.active ? " (inaktiv)" : ""}</td>
                    <td data-label="Tildelt">{v.assignedTo ? `${v.assignedTo.firstName} ${v.assignedTo.lastName}`.trim() : "Fordelt på alle"}</td>
                    <td data-label="Leasing/afskr." className="num">{kr(v.leaseMonthly)}</td>
                    <td data-label="Forsikring" className="num">{kr(v.insuranceMonthly)}</td>
                    <td data-label="Brændstof" className="num">{kr(v.fuelMonthly)}</td>
                    <td data-label="Service" className="num">{kr(v.serviceMonthly)}</td>
                    <td data-label="Andet" className="num">{kr(v.otherMonthly)}</td>
                    <td data-label="I alt/md" className="num"><b>{kr(vehicleMonthlyCost(v))}</b></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link className="btn btn-sm btn-light" href={`/business-manager/biler?edit=${v.id}`}>Rediger</Link>
                        <form action={deleteVehicle.bind(null, v.id)}>
                          <button className="btn btn-sm btn-light" type="submit">Slet</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">{editing ? `Rediger bil — ${editing.name}` : "Tilføj bil"}</h4></div>
        <div className="card-body">
          <form action={saveVehicle}>
            <input type="hidden" name="id" value={editing?.id ?? 0} />
            <div className="f2"><label>Navn</label><div><input name="name" className="form-control form-control-sm" defaultValue={editing?.name ?? ""} placeholder='fx "Van 1 — Ford Transit"' required /></div></div>
            <div className="f2"><label>Tildelt medarbejder</label><div>
              <select name="userId" className="form-control form-control-sm" defaultValue={editing?.userId != null ? String(editing.userId) : ""}>
                {userOptions(editing?.userId ?? null)}
              </select>
              <small className="form-text field-help">Vælger du en medarbejder, myntes bilens udgifter på vedkommende. Ellers tæller bilen kun i flåde-totalen — ikke i nogen medarbejders kostpris.</small>
            </div></div>
            <div className="f2"><label>Leasing/afskrivning (kr/md)</label><div><input name="leaseMonthly" type="number" min="0" className="form-control form-control-sm" defaultValue={editing?.leaseMonthly ?? ""} placeholder="fx 3500" /></div></div>
            <div className="f2"><label>Forsikring (kr/md)</label><div><input name="insuranceMonthly" type="number" min="0" className="form-control form-control-sm" defaultValue={editing?.insuranceMonthly ?? ""} placeholder="fx 600" /></div></div>
            <div className="f2"><label>Brændstof (kr/md)</label><div><input name="fuelMonthly" type="number" min="0" className="form-control form-control-sm" defaultValue={editing?.fuelMonthly ?? ""} placeholder="fx 1800" /></div></div>
            <div className="f2"><label>Service/værksted (kr/md)</label><div><input name="serviceMonthly" type="number" min="0" className="form-control form-control-sm" defaultValue={editing?.serviceMonthly ?? ""} placeholder="fx 400" /></div></div>
            <div className="f2"><label>Andet (kr/md)</label><div><input name="otherMonthly" type="number" min="0" className="form-control form-control-sm" defaultValue={editing?.otherMonthly ?? ""} placeholder="fx 150" /></div></div>
            <div className="f2"><label>Bemærkning</label><div><input name="note" className="form-control form-control-sm" defaultValue={editing?.note ?? ""} /></div></div>
            <div className="f2"><label>Aktiv</label><div><label className="form-check-inline"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Bruges i beregningerne</label></div></div>
            <div className="row-actions">
              <button className="btn btn-primary" type="submit">{editing ? "Gem ændringer" : "Tilføj bil"}</button>
              {editing ? <Link className="btn btn-light" href="/business-manager/biler">Annuller</Link> : null}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
