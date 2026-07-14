import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { getUser } from "@/lib/users";
import { updateUser } from "@/app/actions/users";
import UserForm from "@/components/UserForm";

export const metadata = { title: "Rediger bruger · Karltoffel" };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const userId = Number(id);
  const initial = await getUser(userId);
  if (!initial) notFound();

  return (
    <UserForm
      action={updateUser.bind(null, userId)}
      initial={initial}
      title="Rediger bruger"
      submitLabel="Gem ændringer"
      cancelHref="/users"
    />
  );
}
