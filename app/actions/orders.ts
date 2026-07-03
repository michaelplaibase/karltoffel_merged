"use server";

// Server action for the "Afslut ordre" (complete order) flow. Records the
// delivery status (+ optional comment / address note) and marks the order.
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CompleteOrderState = { error?: string };

// Leveringsstatus radio value -> stored order status.
const STATUS: Record<string, string> = {
  udfoert: "Udført",
  skip: "Sprunget over",
  replan: "Skal genplanlægges",
  other: "Anden status",
};

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
