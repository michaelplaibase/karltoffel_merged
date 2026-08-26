import { notFound } from "next/navigation";

/** Parse et [id]-rutesegment strengt til et positivt heltal — alt andet giver
 *  404 i stedet for en PrismaClientValidationError (rå 500) på tastefejls-URL'er.
 *  Bruges af alle id-sider: /customers, /orders, /subscriptions, /fixed-prices,
 *  /users m.fl. */
export function routeId(raw: string | undefined): number {
  if (raw == null || !/^\d{1,9}$/.test(raw)) notFound();
  return Number(raw);
}
