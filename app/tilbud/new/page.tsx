import { prisma } from "@/lib/db";
import { createTilbud } from "@/app/actions/tilbud";
import TilbudForm from "@/components/TilbudForm";

export const metadata = { title: "Nyt tilbud · Karltoffel Business Manager" };
export const dynamic = "force-dynamic";

async function loadContacts() {
  return prisma.contact.findMany({
    orderBy: { id: "desc" },
    select: { id: true, name: true, companyName: true, isCompany: true },
    take: 2000,
  });
}

// Medarbejdere til den interne vælger pr. opgavelinje — SAMME kilde som
// abonnements-formularen (aktive users med id + navn).
async function loadEmployees() {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    select: { id: true, firstName: true, lastName: true },
  }).then((users) => users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })));
}

export default async function NyTilbudPage() {
  let contacts: Awaited<ReturnType<typeof loadContacts>> = [];
  let employees: Awaited<ReturnType<typeof loadEmployees>> = [];
  let dbFejl = false;
  try {
    [contacts, employees] = await Promise.all([loadContacts(), loadEmployees()]);
  } catch {
    dbFejl = true;
  }
  if (dbFejl) {
    return (
      <div className="container-1140">
        <h1 className="page-title">Nyt tilbud</h1>
        <div className="card"><div className="card-body">
          <p style={{ color: "#8A6931" }}>Databasen i denne testudgave mangler endnu Tilbud-tabellerne — de oprettes automatisk, når modulet sættes live.</p>
        </div></div>
      </div>
    );
  }
  return <TilbudForm contacts={contacts} employees={employees} action={createTilbud} />;
}
