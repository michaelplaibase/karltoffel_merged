import { prisma } from "@/lib/db";
import { createTilbud } from "@/app/actions/tilbud";
import TilbudForm from "@/components/TilbudForm";

export const metadata = { title: "Nyt tilbud · Karltoffel Business Manager" };

export default async function NyTilbudPage() {
  const contacts = await prisma.contact.findMany({
    orderBy: { id: "desc" },
    select: { id: true, name: true, companyName: true },
    take: 2000,
  });
  return <TilbudForm contacts={contacts} action={createTilbud} />;
}