import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildQuoteDraft } from "@/lib/quote";
import { sendQuoteEmail } from "@/app/actions/quotes";
import QuoteComposer from "@/components/QuoteComposer";

export const metadata = { title: "Send tilbud · Karltoffel" };

// Quote based on a specific order — the primary flow: the order's priced task
// lines become the quote's task list and total.
export default async function OrderQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = Number(id);
  const order = Number.isFinite(oid)
    ? await prisma.order.findUnique({ where: { id: oid }, include: { contact: true, tasks: true } })
    : null;
  if (!order) notFound();

  const company = await prisma.company.findFirst();
  const orderLike = { deliveryAddress: order.deliveryAddress, tasks: order.tasks };
  const draft = await buildQuoteDraft(order.contact, orderLike, company ?? { name: "", phone: null, email: null });
  const tasks = order.tasks.map((t) => ({ description: t.description, price: t.price }));

  return (
    <QuoteComposer
      {...draft}
      tasks={tasks}
      total={tasks.reduce((a, t) => a + t.price, 0)}
      backHref={`/orders/${order.id}`}
      action={sendQuoteEmail}
    />
  );
}
