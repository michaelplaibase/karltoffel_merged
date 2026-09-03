import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { PRICE_ADJUSTMENT as P } from "@/lib/funktioner";
import PriceAdjustmentWizard from "@/components/PriceAdjustmentWizard";

export const metadata = { title: "Prisjustering · Karltoffel Business Manager" };

export default async function PriceAdjustmentPage() {
  // Kun administratorer — funktionssiderne er admin-only (Thomas, 2026-08-31).
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  if (!me.isAdmin) redirect("/calendar");
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">{P.title}</h1>
      <PriceAdjustmentWizard />
    </div>
  );
}
