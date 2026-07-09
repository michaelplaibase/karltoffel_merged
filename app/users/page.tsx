import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { getUsers } from "@/lib/users";
import UserManager from "@/components/UserManager";

export const metadata = { title: "Brugere · Karltoffel" };

export default async function UsersPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  // Kun administratorer har adgang til brugerstyring.
  if (!me.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 900 }}>
        <div className="card">
          <div className="card-body">
            <h1 className="page-title">Brugere</h1>
            <div className="table-empty">Kun administratorer har adgang til brugerstyring.</div>
          </div>
        </div>
      </div>
    );
  }

  const users = await getUsers();
  return <UserManager users={users} />;
}
