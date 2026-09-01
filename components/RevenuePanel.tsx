// Omsætningsoverblik for abonnementsoversigten — månedlig + årlig forventet
// omsætning i DKK, så teamet altid kan se, om der er nok arbejde til det
// nuværende personale. Server component: data beregnes i
// lib/subscription-revenue.ts (samme rytmeregler som ordregenereringen).
import { money } from "@/components/ui";
import type { SubscriptionRevenue } from "@/lib/subscription-revenue";

/** Beløb med øre (da-DK), fx "12.345,50 kr" — månedsgennemsnit er sjældent heltal. */
function moneyOre(n: number) {
  return n.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
}

export default function RevenuePanel({ revenue }: { revenue: SubscriptionRevenue }) {
  return (
    <aside className="revenue-panel card" aria-label="Omsætningsoverblik for abonnementer">
      <div className="card-header">
        <h4 className="section-title">Omsætningsoverblik</h4>
      </div>
      <div className="card-body tight">
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Månedlig (inkl. moms)</span>
          <span className="revenue-kpi-value">{moneyOre(revenue.monthlyKr)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Årlig (inkl. moms)</span>
          <span className="revenue-kpi-value">{money(revenue.yearlyKr)}</span>
        </div>

        <dl className="revenue-facts">
          <div>
            <dt>Aktive abonnementer</dt>
            <dd className="num">{revenue.activeCount.toLocaleString("da-DK")}</dd>
          </div>
          <div>
            <dt>Gns. pr. abonnement / måned</dt>
            <dd className="num">{moneyOre(revenue.avgPerSubscriptionKr)}</dd>
          </div>
          {revenue.pendingCount > 0 ? (
            <div>
              <dt>Afventende ({revenue.pendingCount}) — ekstra potentiale</dt>
              <dd className="num">{moneyOre(revenue.pendingMonthlyKr)} / måned</dd>
            </div>
          ) : null}
        </dl>

        {revenue.byEmployee.length > 0 ? (
          <div className="revenue-emps" role="table" aria-label="Forventet omsætning pr. medarbejder">
            <div className="revenue-emps-header" role="row">
              <span>Medarbejder</span>
              <span className="num">Måned</span>
              <span className="num">År</span>
            </div>
            {revenue.byEmployee.map((e) => (
              <div className="revenue-emps-row" role="row" key={e.employee}>
                <span role="cell">{e.employee === "Ingen" ? "Ikke tildelt" : e.employee}</span>
                <span className="num" role="cell">{moneyOre(e.monthlyKr)}</span>
                <span className="num" role="cell">{moneyOre(e.yearlyKr)}</span>
              </div>
            ))}
            <div className="revenue-emps-row revenue-emps-total" role="row">
              <span role="cell">I alt</span>
              <span className="num" role="cell">{moneyOre(revenue.byEmployee.reduce((n, e) => n + e.monthlyKr, 0))}</span>
              <span className="num" role="cell">{moneyOre(revenue.byEmployee.reduce((n, e) => n + e.yearlyKr, 0))}</span>
            </div>
          </div>
        ) : null}

        <p className="revenue-note">
          Beregnet ud fra hver opgaves rytme (basisinterval × interval) over 52 uger.
          &quot;På anmodning&quot;-opgaver og pausevinduer er fratrukket. Bruges til at
          vurdere, om der er nok abonnementsarbejde til det nuværende personale.
        </p>
      </div>
    </aside>
  );
}
