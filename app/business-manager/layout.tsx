// Business Manager — delt layout med admin-værn (kun administratorer).
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import BusinessManagerTabs from "@/components/BusinessManagerTabs";

export const metadata = { title: "Business Manager · Karltoffel Business Manager" };

export default async function BusinessManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 900 }}>
        <div className="card"><div className="card-body">
          <h1 className="page-title">Business Manager</h1>
          <div className="table-empty">Kun administratorer har adgang til Business Manager.</div>
        </div></div>
      </div>
    );
  }

  return (
    <div className="container-1140 container-wide">
      <h1 className="page-title">Business Manager</h1>
      <p className="page-desc">
        Selskabets økonomi samlet: kostpriser, dækning, budget vs. realiseret — bygget på jeres
        egne tal i CRM (ordrer, løn, faste udgifter) plus biler og maskiner, I selv udfylder.
      </p>
      <BusinessManagerTabs />
      {children}
    </div>
  );
}
