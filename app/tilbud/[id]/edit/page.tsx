import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { tilbudKanRedigeres } from "@/lib/tilbud.mts";
import { updateTilbud } from "@/app/actions/tilbud";
import TilbudForm from "@/components/TilbudForm";

export const metadata = { title: "Ret tilbud · Karltoffel Business Manager" };
export const dynamic = "force-dynamic";

// Medarbejdere til den INTERNE vælger pr. opgavelinje — samme kilde som
// abonnements-formularen og opret-tilbud-siden (aktive users).
async function loadEmployees() {
  return prisma.user.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    select: { id: true, firstName: true, lastName: true },
  }).then((users) => users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })));
}

// Thomas, 2026-09-17: redigér et EKSISTERENDE tilbud internt. Konkret use case:
// et tilbud der allerede er SENDT, hvor kunden fx vil rykke startugen. Siden
// forudfylder TilbudForm (edit-mode) og sender til updateTilbud.
export default async function RetTilbudPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tilbudId = Number(id);
  if (!Number.isInteger(tilbudId) || tilbudId <= 0) notFound();

  let tilbud: Awaited<ReturnType<typeof loadTilbud>>;
  const loadTilbud = () => prisma.tilbud.findUnique({
    where: { id: tilbudId },
    include: {
      contact: { select: { id: true, name: true, companyName: true } },
      lines: { orderBy: { sort: "asc" }, include: { employee: { select: { id: true } } } },
    },
  });
  try {
    tilbud = await loadTilbud();
  } catch {
    // Preview-database uden Tilbud-tabellerne → venlig (ikke crash).
    return (
      <div className="container-1140" style={{ maxWidth: 1100 }}>
        <div className="card"><div className="card-body">
          <p style={{ color: "#8a5a10", margin: 0 }}>Tilbud-tabellerne findes ikke i denne testudgaves database — modulet virker fuldt, når det sættes live.</p>
        </div></div>
      </div>
    );
  }
  if (!tilbud) notFound();

  // KUN 'udkast' eller 'sendt' kan redigeres manuelt — 'accepteret' og
  // 'konverteret' er låste kontrakter (og blokeres også af updateTilbud).
  if (!tilbudKanRedigeres(tilbud.status)) notFound();

  const employees = await loadEmployees();

  return (
    <TilbudForm
      contacts={[]}
      employees={employees}
      action={updateTilbud}
      initial={{
        id: tilbud.id,
        contactId: tilbud.contactId,
        contactName: tilbud.contact.companyName || tilbud.contact.name,
        title: tilbud.title,
        note: tilbud.note,
        startWeek: tilbud.startWeek,
        baseInterval: tilbud.baseInterval,
        leadSource: tilbud.leadSource,
        lines: tilbud.lines.map((l) => ({
          id: l.id,
          description: l.description,
          price: l.price,
          category: l.category || "Andet",
          interval: l.interval,
          startWeek: l.startWeek,
          employee: l.employee ? String(l.employee.id) : "",
          pauseActive: l.pauseActive,
          pauseStart: l.pauseStart,
          pauseEnd: l.pauseEnd,
          pauseYearly: l.pauseYearly,
        })),
      }}
    />
  );
}
