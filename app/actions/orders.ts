"use server";

// Server actions for orders: create a manual order, and the "Afslut ordre"
// (complete order) flow.
import { prisma } from "@/lib/db";
import { categoryColor } from "@/lib/categories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type OrderCreateState = { error?: string };

/** Read the repeated task-line fields (aligned by index) from the form. */
function readTaskLines(formData: FormData) {
  const descs = formData.getAll("taskDescription").map(String);
  const prices = formData.getAll("taskPrice").map((v) => Number(v) || 0);
  const durs = formData.getAll("taskDuration").map((v) => Number(v) || 0);
  const cats = formData.getAll("taskCategory").map(String);
  return descs
    .map((d, i) => ({ description: d.trim(), price: prices[i] || 0, durationMin: durs[i] || 0, category: cats[i] || "Andet" }))
    .filter((l) => l.description);
}

export async function createOrder(_prev: OrderCreateState, formData: FormData): Promise<OrderCreateState> {
  const contactId = Number(formData.get("contactId"));
  if (!contactId) return { error: "Vælg en kunde." };
  const lines = readTaskLines(formData);
  if (!lines.length) return { error: "Tilføj mindst én opgave." };

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  const week = String(formData.get("week") ?? "");
  const plannedAt = week ? new Date(`${week}T10:00:00Z`) : new Date();
  const user = await prisma.user.findFirst();

  const order = await prisma.order.create({
    data: {
      contactId,
      deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
      plannedAt,
      sourceType: "manual",
      employeeId: user?.id ?? null,
      status: "Afventer levering",
      tasks: {
        create: lines.map((l, i) => ({
          category: l.category, letter: (l.category[0] ?? "A").toUpperCase(), color: categoryColor(l.category),
          description: l.description, price: l.price, durationMin: l.durationMin, sort: i,
        })),
      },
    },
  });

  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect(`/orders/${order.id}`);
}

export type CompleteOrderState = { error?: string };

// Leveringsstatus radio value -> stored order status.
const STATUS: Record<string, string> = {
  udfoert: "Udført",
  skip: "Sprunget over",
  replan: "Skal genplanlægges",
  other: "Anden status",
};

/** Delete an order and its task lines. */
export async function deleteOrder(orderId: number): Promise<void> {
  await prisma.$transaction([
    prisma.taskLine.deleteMany({ where: { orderId } }),
    prisma.order.delete({ where: { id: orderId } }),
  ]);
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect("/orders");
}

export async function completeOrder(orderId: number, _prev: CompleteOrderState, formData: FormData): Promise<CompleteOrderState> {
  const leveringsstatus = String(formData.get("leveringsstatus") ?? "");
  if (!leveringsstatus || !(leveringsstatus in STATUS)) return { error: "Vælg en leveringsstatus." };

  const comment = String(formData.get("comment") ?? "").trim();
  const addressNote = String(formData.get("addressNote") ?? "").trim();
  const backUrl = String(formData.get("backUrl") ?? "/orders") || "/orders";

  await prisma.order.update({
    where: { id: orderId },
    data: { status: STATUS[leveringsstatus], comment: comment || null, addressNote: addressNote || null },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/daycalendar");
  revalidatePath("/calendar");
  redirect(backUrl);
}
