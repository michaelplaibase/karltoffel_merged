import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildQuoteDraft } from "@/lib/quote";
import { sendQuoteEmail } from "@/app/actions/quotes";
import QuoteComposer from "@/components/QuoteComposer";

export const metadata = { title: "Send tilbud · Karltoffel" };

// Quote based on a customer — prefills from the customer's most recent order (if
// any), so the task list/total match real priced work; otherwise the quote is
// text-only and staff fill in the details.
export default async function CustomerQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  const contact = Number.isFinite(cid) ? await prisma.contact.findUnique({ where: { id: cid } }) : null;
  if (!contact) notFound();

  const [order, company] = await Promise.all([
    prisma.order.findFirst({ where: { contactId: contact.id }, include: { tasks: true }, orderBy: { plannedAt: "desc" } }),
    prisma.company.findFirst(),
  ]);

  const orderLike = order ? { deliveryAddress: order.deliveryAddress, tasks: order.tasks } : null;
  const draft = await buildQuoteDraft(contact, orderLike, company ?? { name: "", phone: null, email: null });
  const tasks = order ? order.tasks.map((t) => ({ description: t.description, price: t.price })) : [];

  return (
    <QuoteComposer
      {...draft}
      tasks={tasks}
      total={tasks.reduce((a, t) => a + t.price, 0)}
      backHref={`/customers/${contact.id}`}
      action={sendQuoteEmail}
    />
  );
}
