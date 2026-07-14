"use server";

// Server actions for subscriptions (Abonnement): create and update, including
// the task-line formset (with interval + next-week per line).
import { prisma, isUniqueViolation } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { categoryColor } from "@/lib/categories";
import { generateForSubscriptionId, generateAllSubscriptionOrders, regenerateFutureOrders } from "@/lib/recurrence";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SubscriptionState = { error?: string };

/** Materialise upcoming orders for every active subscription (manual button). */
export async function regenerateOrders(): Promise<void> {
  await guardAction();
  await generateAllSubscriptionOrders();
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect("/orders");
}

function readTaskLines(formData: FormData) {
  const descs = formData.getAll("taskDescription").map(String);
  const prices = formData.getAll("taskPrice").map((v) => Number(v) || 0);
  const durs = formData.getAll("taskDuration").map((v) => Number(v) || 0);
  const cats = formData.getAll("taskCategory").map(String);
  const intervals = formData.getAll("taskInterval").map(String);
  const nextWeeks = formData.getAll("taskNextWeek").map(String);
  // "Måneder på pause" — submittes som skjulte felter for HVER række (også
  // upausede), så det positionsvise zip med taskDescription aldrig forskubbes.
  const pauseActives = formData.getAll("taskPauseActive").map(String);
  const pauseStarts = formData.getAll("taskPauseStart").map(String);
  const pauseEnds = formData.getAll("taskPauseEnd").map(String);
  const pauseYearlies = formData.getAll("taskPauseYearly").map(String);
  return descs
    .map((d, i) => ({
      description: d.trim(), price: prices[i] || 0, durationMin: durs[i] || 0,
      category: cats[i] || "Andet", interval: intervals[i] || "Hver gang", nextWeek: (nextWeeks[i] || "").trim(),
      pauseActive: pauseActives[i] || "0", pauseStart: (pauseStarts[i] || "").trim(),
      pauseEnd: (pauseEnds[i] || "").trim(), pauseYearly: pauseYearlies[i] || "1",
    }))
    .filter((l) => l.description);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function taskCreate(lines: ReturnType<typeof readTaskLines>) {
  return lines.map((l, i) => {
    // Lempelig pause-validering: mangler/ugyldig dato ⇒ gem som ikke-pauset
    // frem for at fejle hele abonnements-gemningen.
    const paused = l.pauseActive === "1" && ISO_DATE.test(l.pauseStart) && ISO_DATE.test(l.pauseEnd);
    return {
      category: l.category, letter: (l.category[0] ?? "A").toUpperCase(), color: categoryColor(l.category),
      description: l.description, price: l.price, durationMin: l.durationMin,
      intervalMultiplier: l.interval, startWeek: l.nextWeek || null, isStandardTask: false, sort: i,
      pauseActive: paused, pauseStart: paused ? l.pauseStart : null, pauseEnd: paused ? l.pauseEnd : null,
      pauseYearly: l.pauseYearly !== "0",
    };
  });
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

/** Stop a subscription: mark inactive AND rydder de allerede-materialiserede
 *  fremtidige ordrer (pending + ulåste, fra næste uge) — ellers bliver en
 *  opsagt kunde ved med at få besøg i op til 26 uger. Historik, afsluttede,
 *  låste og indeværende uges ordrer røres ikke (samme kriterier som
 *  regenerateFutureOrders i lib/recurrence.ts). */
export async function stopSubscription(pk: number): Promise<void> {
  await guardAction();
  const sub = await prisma.subscription.update({ where: { id: pk }, data: { active: false, pending: false }, select: { contactId: true } });

  const nextMonday = new Date(mondayOfUTCNow().getTime() + 7 * 864e5);
  const stale = await prisma.order.findMany({
    where: { subscriptionId: pk, plannedAt: { gte: nextMonday }, status: "Afventer levering", lockedFully: false },
    select: { id: true },
  });
  if (stale.length) {
    const ids = stale.map((o) => o.id);
    await prisma.$transaction([
      prisma.taskLine.deleteMany({ where: { orderId: { in: ids } } }),
      prisma.order.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath(`/customers/${sub.contactId}`);
  redirect("/subscriptions");
}

/** Godkend et AFVENTENDE abonnement (dit trin 5: opkaldet bekræftede prisen):
 *  aktivér det og materialisér de kommende ordrer med det samme. */
export async function approveSubscription(pk: number): Promise<void> {
  await guardAction();
  const sub = await prisma.subscription.update({
    where: { id: pk },
    data: { active: true, pending: false },
    select: { contactId: true, displayNo: true },
  });
  await generateForSubscriptionId(pk);
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath(`/customers/${sub.contactId}`);
  redirect(`/subscriptions/${sub.displayNo}`);
}

/** Mandag (UTC midnat) i indeværende uge. */
function mondayOfUTCNow(): Date {
  const d = new Date();
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * 864e5);
}

export async function createSubscription(_prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  await guardAction();
  const p = parse(formData);
  if ("error" in p) return p;
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  const nextWeek = p.lines.map((l) => l.nextWeek).find(Boolean) || p.startWeek || null;
  const deliveryAddress = contact.city ? `${contact.street}, ${contact.city}` : contact.street;

  // Allocate "Abo. nr." (displayNo) + insert with retry: two concurrent creates
  // can read the same max and collide on the unique index (P2002) — re-read on retry.
  let subId = 0, subDisplayNo = 0;
  for (let attempt = 0; ; attempt++) {
    const max = await prisma.subscription.aggregate({ _max: { displayNo: true } });
    const displayNo = (max._max.displayNo ?? 235800) + 1;
    try {
      const created = await prisma.subscription.create({
        data: {
          displayNo, contactId: p.contactId, deliveryAddress,
          baseInterval: p.baseInterval, startWeek: p.startWeek || null, nextWeek,
          fixedEmployee: p.fixedEmployee, tasks: { create: taskCreate(p.lines) },
        },
      });
      subId = created.id; subDisplayNo = created.displayNo;
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
  await generateForSubscriptionId(subId); // materialise its upcoming orders
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath(`/customers/${p.contactId}`);
  redirect(`/subscriptions/${subDisplayNo}`);
}

export async function updateSubscription(pk: number, _prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  await guardAction();
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

  await regenerateFutureOrders(pk); // propagate the edit to future (pending, unlocked) orders
  const sub = await prisma.subscription.findUnique({ where: { id: pk }, select: { displayNo: true, contactId: true } });
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  if (sub) revalidatePath(`/customers/${sub.contactId}`);
  redirect(`/subscriptions/${sub?.displayNo ?? ""}`);
}
