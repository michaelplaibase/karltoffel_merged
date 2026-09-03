// Business Manager — Maskiner: register med afskrivning og faste omkostninger.
import { prisma } from "@/lib/db";
import { saveMachine, deleteMachine } from "@/app/actions/business-manager";
import { machineDepreciationMonthly, machineMonthlyCost } from "@/lib/business-manager";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default async function MachinesPage() {
  const machines = await prisma.machine.findMany({ orderBy: { id: "asc" } });
  const active = machines.filter((m) => m.active);
  const total = active.reduce((a, m) => a + machineMonthlyCost(m), 0);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Maskiner ({active.length} aktive) — {kr(total)} /md i alt</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th data-label="Maskine">Maskine</th>
                  <th data-label="Indkøbspris">Indkøbspris</th>
                  <th data-label="Levetid">Levetid</th>
                  <th data-label="Afskrivning/md">Afskrivning/md</th>
                  <th data-label="Service/md">Service/md</th>
                  <th data-label="Andet/md">Andet/md</th>
                  <th data-label="I alt/md">I alt/md</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {machines.length === 0 ? (
                  <tr><td colSpan={8}><div className="table-empty">Ingen maskiner endnu — opret den første nedenfor. Afskrivning = indkøbspris ÷ levetid ÷ 12.</div></td></tr>
                ) : machines.map((m) => (
                  <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                    <td data-label="Maskine">{m.name}{!m.active ? " (inaktiv)" : ""}</td>
                    <td data-label="Indkøbspris" className="num">{kr(m.purchasePrice)}</td>
                    <td data-label="Levetid" className="num">{m.lifetimeYears > 0 ? `${m.lifetimeYears} år` : "—"}</td>
                    <td data-label="Afskrivning/md" className="num">{kr(machineDepreciationMonthly(m))}</td>
                    <td data-label="Service/md" className="num">{kr(m.serviceMonthly)}</td>
                    <td data-label="Andet/md" className="num">{kr(m.otherMonthly)}</td>
                    <td data-label="I alt/md" className="num"><b>{kr(machineMonthlyCost(m))}</b></td>
                    <td>
                      <form action={deleteMachine.bind(null, m.id)} style={{ display: "inline" }}>
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
        <div className="card-header"><h4 className="section-title">Tilføj maskine</h4></div>
        <div className="card-body">
          <form action={saveMachine}>
            <div className="f2"><label>Navn</label><div><input name="name" className="form-control form-control-sm" placeholder='fx "Vandrenser 2"' required /></div></div>
            <div className="f2"><label>Indkøbspris (kr)</label><div><input name="purchasePrice" type="number" min="0" className="form-control form-control-sm" placeholder="fx 25000" /></div></div>
            <div className="f2"><label>Forventet levetid (år)</label><div><input name="lifetimeYears" type="number" min="0" className="form-control form-control-sm" placeholder="fx 5" /></div></div>
            <div className="f2"><label>Service/vedligehold (kr/md)</label><div><input name="serviceMonthly" type="number" min="0" className="form-control form-control-sm" placeholder="fx 100" /></div></div>
            <div className="f2"><label>Andet (kr/md)</label><div><input name="otherMonthly" type="number" min="0" className="form-control form-control-sm" /></div></div>
            <div className="f2"><label>Bemærkning</label><div><input name="note" className="form-control form-control-sm" /></div></div>
            <div className="f2"><label>Aktiv</label><div><label className="form-check-inline"><input type="checkbox" name="active" defaultChecked /> Bruges i beregningerne</label></div></div>
            <div className="row-actions"><button className="btn btn-primary" type="submit">Tilføj maskine</button></div>
          </form>
        </div>
      </div>
    </>
  );
}
