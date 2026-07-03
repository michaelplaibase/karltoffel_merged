"use server";

// Server actions for fixed-price agreements (Fastprisaftale): create and update,
// including the task-line formset (no interval — a fixed-price agreement has no
// recurrence, only description/category/price/duration per line).
import { prisma } from "@/lib/db";
import { categoryColor } from "@/lib/categories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FixedPriceState = { error?: string };

/** Delete a fixed-price agreement and its task lines. */
export async function deleteFixedPrice(pk: number): Promise<void> {
  const fp = await prisma.fixedPriceAgreement.findUnique({ where: { id: pk }, select: { contactId: true } });
  await prisma.$transaction([
    prisma.taskLine.deleteMany({ where: { fixedPriceId: pk } }),
    prisma.fixedPriceAgreement.delete({ where: { id: pk } }),
  ]);
  revalidatePath("/fixed-prices");
  if (fp) revalidatePath(`/customers/${fp.contactId}`);
  redirect("/fixed-prices");
}

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

function taskCreate(lines: ReturnType<typeof readTaskLines>) {
  return lines.map((l, i) => ({
    category: l.category, letter: (l.category[0] ?? "A").toUpperCase(), color: categoryColor(l.category),
    description: l.description, price: l.price, durationMin: l.durationMin, sort: i,
  }));
}

type Fields = { contactId: number; lines: ReturnType<typeof readTaskLines> };
function parse(formData: FormData): Fields | { error: string } {
  const contactId = Number(formData.get("contactId"));
  if (!contactId) return { error: "Vælg en kunde." };
  const lines = readTaskLines(formData);
  if (!lines.length) return { error: "Tilføj mindst én opgave." };
  return { contactId, lines };
}

export async function createFixedPrice(_prev: FixedPriceState, formData: FormData): Promise<FixedPriceState> {
  const p = parse(formData);
  if ("error" in p) return p;
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  const max = await prisma.fixedPriceAgreement.aggregate({ _max: { displayNo: true } });
  const displayNo = (max._max.displayNo ?? 100000) + 1;

  const created = await prisma.fixedPriceAgreement.create({
    data: {
      displayNo, contactId: p.contactId,
      deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
      tasks: { create: taskCreate(p.lines) },
    },
  });
  revalidatePath("/fixed-prices");
  revalidatePath(`/customers/${p.contactId}`);
  redirect(`/fixed-prices/${created.displayNo}`);
}

export async function updateFixedPrice(pk: number, _prev: FixedPriceState, formData: FormData): Promise<FixedPriceState> {
  const p = parse(formData);
  if ("error" in p) return p;
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  await prisma.$transaction([
    prisma.taskLine.deleteMany({ where: { fixedPriceId: pk } }),
    prisma.fixedPriceAgreement.update({
      where: { id: pk },
      data: {
        contactId: p.contactId,
        deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
        tasks: { create: taskCreate(p.lines) },
      },
    }),
  ]);

  const fp = await prisma.fixedPriceAgreement.findUnique({ where: { id: pk }, select: { displayNo: true, contactId: true } });
  revalidatePath("/fixed-prices");
  if (fp) revalidatePath(`/customers/${fp.contactId}`);
  redirect(`/fixed-prices/${fp?.displayNo ?? ""}`);
}
