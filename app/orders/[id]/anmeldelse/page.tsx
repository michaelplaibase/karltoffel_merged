import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { routeId } from "@/lib/route-ids";
import { buildReviewRequestDraft } from "@/app/actions/review-request";
import { sendReviewRequest } from "@/app/actions/review-request";
import QuoteComposer from "@/components/QuoteComposer";

export const metadata = { title: "Bed om anmeldelse · Karltoffel Business Manager" };

// Ét-kliks anmeldelses-anmodning på en afsluttet ordre (Kristian, 2026-09-08):
// genbruger QuoteComposer med anmeldelses-skabelonen (tak + Google-link).
export default async function OrderReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = routeId(id);
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, contactId: true } });
  if (!order) notFound();

  const draft = await buildReviewRequestDraft(order.id);
  if (!draft) notFound(); // ordren/findes ikke, eller kunden har ingen e-mail

  return (
    <QuoteComposer
      to={draft.to}
      subject={draft.subject}
      body={draft.body}
      tasks={[]}
      total={0}
      backHref={`/orders/${order.id}`}
      action={sendReviewRequest}
    />
  );
}
