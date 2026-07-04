import { PRICE_ADJUSTMENT as P } from "@/lib/funktioner";
import PriceAdjustmentWizard from "@/components/PriceAdjustmentWizard";

export const metadata = { title: "Prisjustering · Karltoffel" };

export default function PriceAdjustmentPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">{P.title}</h1>
      <PriceAdjustmentWizard />
    </div>
  );
}
