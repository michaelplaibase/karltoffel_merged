// Omsætningsoverblik (Thomas, 2026-09-03): panel flyttet HELT fra
// faktureringsoverblikket til egen side under Fakturering-menuen — her skal det
// udvides betydeligt (mere teknisk), og faktureringssiden vender tilbage til
// sin rene liste. Ren læseside, admin-only (samme værn som panelets gamle plads).
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import RevenuePanel from "@/components/RevenuePanel";
import { getSubscriptionRevenue } from "@/lib/subscription-revenue";

export const metadata = { title: "Omsætningsoverblik · Karltoffel" };

export default async function OmsaetningsoverblikPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 900 }}>
        <div className="card"><div className="card-body">
          <h1 className="page-title">Omsætningsoverblik</h1>
          <div className="table-empty">Kun administratorer har adgang til Omsætningsoverblikket.</div>
        </div></div>
      </div>
    );
  }

  const revenue = await getSubscriptionRevenue();

  return (
    <div className="container-1140 container-wide">
      <h1 className="page-title">Omsætningsoverblik</h1>
      <p className="page-desc">
        Forventet abonnementsomsætning pr. medarbejder — med løn og faste udgifter
        sat op mod omsætningen.
      </p>
      <RevenuePanel revenue={revenue} />
    </div>
  );
}
