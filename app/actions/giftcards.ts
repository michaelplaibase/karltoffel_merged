"use server";

// Server actions for gavekort-ordrer (/giftcards). Fase 0: MobilePay betales
// manuelt via MobilePay Business-appen — CRM bruges til at (1) markere at en
// betalingsanmodning er indfriet (→ kode genereres + Slack-ping) og (2) markere
// at kortet er sendt pr. mail.
import { prisma, isUniqueViolation } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { postMessage, leadsChannel } from "@/lib/slack";
import { revalidatePath } from "next/cache";

const kr = (minor: number) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(minor / 100);

/** KT-XXXX-XXXX-XXXX uden tvetydige tegn (ingen 0/O, 1/I) + kollisionstjek. */
async function generateCode(): Promise<string> {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "KT-";
    for (let block = 0; block < 3; block++) {
      for (let i = 0; i < 4; i++) code += alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length];
      if (block < 2) code += "-";
    }
    if (!(await prisma.giftCardOrder.findUnique({ where: { code } }))) return code;
  }
  throw new Error("Kunne ikke generere et unikt gavekortskode efter 20 forsøg");
}

/** Kundens MobilePay-betaling er bekræftet → generér kode og ping Slack. */
export async function markGiftCardPaid(orderId: string): Promise<void> {
  await guardAction();
  const order = await prisma.giftCardOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "awaiting_payment") return; // idempotent: kun awaiting_payment → paid
  let code: string;
  try {
    code = await generateCode();
  } catch {
    revalidatePath("/giftcards");
    return;
  }
  try {
    const updated = await prisma.giftCardOrder.update({
      where: { id: orderId },
      data: { status: "paid", code },
    });
    await postMessage({
      channel: process.env.SLACK_GIFTCARD_CHANNEL?.trim() || leadsChannel(),
      text: `✅ Gavekort betalt (MobilePay): ${kr(updated.amountMinor)} kr. Til: ${updated.recipientName} (${updated.recipientEmail}). Kode: ${updated.code}. Send kortet pr. mail.`,
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
  revalidatePath("/giftcards");
}

/** Kortet er sendt pr. mail til modtageren. */
export async function markGiftCardSent(orderId: string): Promise<void> {
  await guardAction();
  const order = await prisma.giftCardOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "paid") return; // kun paid → sent
  await prisma.giftCardOrder.update({ where: { id: orderId }, data: { status: "sent", sentAt: new Date() } });
  revalidatePath("/giftcards");
}

/** Annullér en ordre (fx fejlbestilling). */
export async function cancelGiftCard(orderId: string): Promise<void> {
  await guardAction();
  const order = await prisma.giftCardOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status === "sent" || order.status === "paid") return;
  await prisma.giftCardOrder.update({ where: { id: orderId }, data: { status: "cancelled" } });
  revalidatePath("/giftcards");
}
