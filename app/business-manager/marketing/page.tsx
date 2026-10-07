import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import MarketingDashboard from "./marketing-dashboard";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");
  return <MarketingDashboard />;
}
