"use server";

// Server actions for subscriptions (Abonnement): create and update, including
// the task-line formset (with interval + next-week per line).
import { prisma } from "@/lib/db";
import { categoryColor } from "@/lib/categories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SubscriptionState = { error?: string };

function readTaskLines(formData: FormData) {
  const descs = formData.getAll("taskDescription").map(String);
  const prices = formData.getAll("taskPrice").map((v) => Number(v) || 0);
  const durs = formData.getAll("taskDuration").map((v) => Number(v) || 0);
  const cats = formData.getAll("taskCategory").map(String);
  const intervals = formData.getAll("taskInterval").map(String);
  const nextWeeks = formData.getAll("taskNextWeek").map(String);
  return descs
    .map((d, i) => ({
      description: d.trim(), price: prices[i] || 0, durationMin: durs[i] || 0,
      category: cats[i] || "Andet", interval: intervals[i] || "Hver gang", nextWeek: (nextWeeks[i] || "").trim(),
    }))
    .filter((l) => l.description);
}

function taskCreate(lines: ReturnType<typeof readTaskLines>) {
  return lines.map((l, i) => ({
    category: l.category, letter: (l.category[0] ?? "A").toUpperCase(), color: categoryColor(l.category),
    description: l.description, price: l.price, durationMin: l.durationMin,
    intervalMultiplier: l.interval, startWeek: l.nextWeek || null, isStandardTask: false, sort: i,
  }));
}

type Fields = { contactId: number; baseInterval: string; startWeek: string; fixedEmployee: string; lines: ReturnType<typeof readTaskLines> };
function parse(formData: FormData): Fields | { error: string } {
  const contactId = Number(formData.get("contactId"));
  if (!contactId) return { error: "Vælg en kunde." };
  const baseInterval = String(formData.get("baseInterval") ?? "").trim();
  if (!baseInterval) return { error: "Vælg et basis-interval." };
  const lines = readTaskLines(formData);
  if (!lines.length) return { error: "Tilføj mindst én opgave." };
  return {
    contactId, baseInterval,
    startWeek: String(formData.get("startWeek") ?? "").trim(),
    fixedEmployee: String(formData.get("fixedEmployee") ?? "Ingen") || "Ingen",
    lines,
  };
}

export async function createSubscription(_prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  const p = parse(formData);
  if ("error" in p) return p;
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  const max = await prisma.subscription.aggregate({ _max: { displayNo: true } });
  const displayNo = (max._max.displayNo ?? 235800) + 1;
  const nextWeek = p.lines.map((l) => l.nextWeek).find(Boolean) || p.startWeek || null;

  const created = await prisma.subscription.create({
    data: {
      displayNo, contactId: p.contactId,
      deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
      baseInterval: p.baseInterval, startWeek: p.startWeek || null, nextWeek,
      fixedEmployee: p.fixedEmployee, tasks: { create: taskCreate(p.lines) },
    },
  });
  revalidatePath("/subscriptions");
  revalidatePath(`/customers/${p.contactId}`);
  redirect(`/subscriptions/${created.displayNo}`);
}

export async function updateSubscription(pk: number, _prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  const p = parse(formData);
  if ("error" in p) return p;
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };
  const nextWeek = p.lines.map((l) => l.nextWeek).find(Boolean) || p.startWeek || null;

  await prisma.$transaction([
    prisma.taskLine.deleteMany({ where: { subscriptionId: pk } }),
    prisma.subscription.update({
      where: { id: pk },
      data: {
        contactId: p.contactId,
        deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
        baseInterval: p.baseInterval, startWeek: p.startWeek || null, nextWeek,
        fixedEmployee: p.fixedEmployee, tasks: { create: taskCreate(p.lines) },
      },
    }),
  ]);

  const sub = await prisma.subscription.findUnique({ where: { id: pk }, select: { displayNo: true, contactId: true } });
  revalidatePath("/subscriptions");
  if (sub) revalidatePath(`/customers/${sub.contactId}`);
  redirect(`/subscriptions/${sub?.displayNo ?? ""}`);
}
