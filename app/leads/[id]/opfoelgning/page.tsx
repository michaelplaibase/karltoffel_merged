import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { routeId } from "@/lib/route-ids";
import { buildLeadFollowUpDraft } from "@/app/actions/leads";
import { sendLeadFollowUp } from "@/app/actions/leads";
import QuoteComposer from "@/components/QuoteComposer";

export const metadata = { title: "Opfølgning på emne · Karltoffel Business Manager" };

// Ét-kliks-opfølgning på et lead (Kristian, 2026-09-08): genbruger
// QuoteComposer (samme UI som Send tilbud), men med opfølgnings-skabelonen.
// Ingen opgave-/prislinjer — opfølgningen er en blød "hører I stadig fra os".
export default async function LeadFollowUpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = routeId(id);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();

  const draft = await buildLeadFollowUpDraft(lead.id);
  if (!draft) notFound(); // ingen e-mail på leadet → intet at sende fra

  return (
    <QuoteComposer
      to={draft.to}
      subject={draft.subject}
      body={draft.body}
      tasks={[]}
      total={0}
      backHref="/leads"
      action={sendLeadFollowUp}
    />
  );
}
