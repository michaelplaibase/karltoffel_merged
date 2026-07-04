import { getDiscountCodes } from "@/lib/queries";
import DiscountCodeManager from "@/components/DiscountCodeManager";

export const metadata = { title: "Rabatkoder · Karltoffel" };

export default async function DiscountCodesPage() {
  const codes = await getDiscountCodes();
  return <DiscountCodeManager codes={codes} />;
}
