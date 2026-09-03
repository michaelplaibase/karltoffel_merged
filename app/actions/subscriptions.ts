"use server";

// Server actions for subscriptions (Abonnement): create and update, including
// the task-line formset (with interval + next-week per line).
import { prisma, isUniqueViolation } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { categoryColor } from "@/lib/categories";
import { generateForSubscriptionId, generateAllSubscriptionOrders, regenerateFutureOrders, parseWeekLabel, parseWeekLabelParts } from "@/lib/recurrence";
import { isoWeek } from "@/lib/planner";
import { isoWeekYear, weekLabel } from "@/lib/weeks";
import { weekMondayToday } from "@/lib/calendar";
import { weekdayDigits, parseWeekdayDigits } from "@/lib/task-weekdays";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// values ekkoer de indsendte topfelter tilbage ved valideringsfejl, så
// formularen kan prefille dem igen (React 19 resetter ukontrollerede felter
// når en form-action afvikles — indtastning må aldrig gå tabt ved fejl).
export type SubscriptionState = { error?: string; values?: { startWeek: string; baseInterval: string; fixedEmployee: string } };

export type GenerateOrdersState = { created?: number; error?: string };

/** Materialise upcoming orders for every active subscription (manual button).
 *  Returns the number of orders created so the button can show feedback;
 *  errors are returned (not thrown) so the UI can surface them inline. */
export async function regenerateOrders(_prev: GenerateOrdersState, _formData: FormData): Promise<GenerateOrdersState> {
  await guardAction();
  let created: number;
  try {
    created = await generateAllSubscriptionOrders();
  } catch (e) {
    console.error("regenerateOrders fejlede:", e);
    return { error: "Genereringen fejlede. Prøv igen — eller kontakt support, hvis problemet gentager sig." };
  }
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  return { created };
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
  // Ugedage-begrænsning pr. opgave — skjult felt der ALTID submittes pr. række
  // (digit-streng "0"-"6", 0=mandag … 6=søndag; tom = alle dage).
  const weekdaySets = formData.getAll("taskWeekdays").map(String);
  return descs
    .map((d, i) => ({
      description: d.trim(), price: prices[i] || 0, durationMin: durs[i] || 0,
      category: cats[i] || "Andet", interval: intervals[i] || "Hver gang", nextWeek: (nextWeeks[i] || "").trim(),
      pauseActive: pauseActives[i] || "0", pauseStart: (pauseStarts[i] || "").trim(),
      pauseEnd: (pauseEnds[i] || "").trim(), pauseYearly: pauseYearlies[i] || "1",
      weekdays: (weekdaySets[i] || "").trim(),
    }))
    .filter((l) => l.description);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function taskCreate(lines: ReturnType<typeof readTaskLines>) {
  return lines.map((l, i) => {
    // Pausedatoerne er valideret i parse() — her er "1" altid en gyldig pause.
    const paused = l.pauseActive === "1" && ISO_DATE.test(l.pauseStart) && ISO_DATE.test(l.pauseEnd);
    return {
      category: l.category, letter: (l.category[0] ?? "A").toUpperCase(), color: categoryColor(l.category),
      description: l.description, price: l.price, durationMin: l.durationMin,
      intervalMultiplier: l.interval, startWeek: l.nextWeek || null, isStandardTask: false, sort: i,
      pauseActive: paused, pauseStart: paused ? l.pauseStart : null, pauseEnd: paused ? l.pauseEnd : null,
      pauseYearly: l.pauseYearly !== "0",
      weekdays: weekdayDigits(parseWeekdayDigits(l.weekdays)) || null, // normaliseret "013"-form; tom/ugyldig → null (alle dage)
    };
  });
}

/** Normalisér en uge-angivelse til det ENTYDIGE lagringsformat "Uge N, YYYY".
 *  Accepterer "29", "uge29", "Uge 29" og "Uge 29, 2026". Årløst input opløses
 *  til NÆSTE forekomst (uge ≥ indeværende uge = i år, ellers næste år) — så
 *  en bevidst sæsonstart altid gemmes med eksplicit år, og en passeret uge
 *  aldrig igen kan fejltolkes som "næste års forekomst" (uge 35-hændelsen,
 *  hvor 8 abonnementer forsvandt fra kalenderen i op til et år).
 *  Ugyldigt/ude af interval → null. */
function normalizeWeekLabel(raw: string): string | null {
  const parts = parseWeekLabelParts(raw.trim());
  if (!parts) return null;
  if (parts.year != null) return `Uge ${parts.week}, ${parts.year}`;
  const nowMonday = weekMondayToday();
  const year = isoWeekYear(nowMonday) + (parts.week < isoWeek(nowMonday) ? 1 : 0);
  return `Uge ${parts.week}, ${year}`;
}

type Fields = { contactId: number; baseInterval: string; startWeek: string; fixedEmployee: string; lines: ReturnType<typeof readTaskLines> };
function parse(formData: FormData): Fields | ({ error: string } & Pick<SubscriptionState, "values">) {
  // Felterne læses FØR valideringen, så alle fejl-returer kan ekko dem tilbage
  // (React 19 form-reset: uden values mister brugeren sin indtastning).
  const baseInterval = String(formData.get("baseInterval") ?? "").trim();
  const startWeekRaw = String(formData.get("startWeek") ?? "").trim();
  const fixedEmployee = String(formData.get("fixedEmployee") ?? "Ingen") || "Ingen";
  const values = { startWeek: startWeekRaw, baseInterval, fixedEmployee };

  const contactId = Number(formData.get("contactId"));
  if (!contactId) return { error: "Vælg en kunde.", values };
  if (!baseInterval) return { error: "Vælg et basis-interval.", values };
  // Startuge SKAL kunne forstås af genereringen — ellers oprettes et abonnement,
  // der aldrig genererer én eneste ordre, helt stille.
  const startWeek = normalizeWeekLabel(startWeekRaw);
  if (!startWeek) return { error: "Angiv startuge som fx 'Uge 29' eller 'Uge 29, 2026'.", values };
  const lines = readTaskLines(formData);
  if (!lines.length) return { error: "Tilføj mindst én opgave.", values };
  for (const l of lines) {
    // "Næste gang" er valgfri, men en udfyldt værdi skal være i et format
    // genereringen forstår — ellers ignoreres den stille.
    if (l.nextWeek) {
      const nw = normalizeWeekLabel(l.nextWeek);
      if (!nw) return { error: `Angiv 'Næste gang' som fx 'Uge 29' eller 'Uge 29, 2026' på opgaven '${l.description}'.`, values };
      l.nextWeek = nw;
    }
    // Pause: et sat flueben med ryddet/ugyldig dato må aldrig stille gemmes som
    // ikke-pauset — kunden ville få besøg i den periode, kontoret troede var pauset.
    if (l.pauseActive === "1" && (!ISO_DATE.test(l.pauseStart) || !ISO_DATE.test(l.pauseEnd))) {
      return { error: `Angiv start- og slutdato for pausen på opgaven '${l.description}'.`, values };
    }
  }
  return { contactId, baseInterval, startWeek, fixedEmployee, lines };
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
  revalidatePath("/daycalendar");
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
    select: { contactId: true, displayNo: true, startWeek: true },
  });
  // Startugen er årløs ("Uge N") og blev typisk sat til "næste uge" ved
  // lead-konverteringen. Godkendes abonnementet FØRST uger senere, er ugen
  // passeret — og generatoren (nyt abonnement uden ordrer) ville fortolke den
  // som NÆSTE års forekomst: nul ordrer i op til et år, helt stille. Er ugen
  // mere end et halvt år ude i "fremtiden", er den reelt lige passeret →
  // ryk starten til næste uge. En bevidst sæsonstart (< 26 uger ude) bevares.
  const stored = parseWeekLabel(sub.startWeek);
  if (stored != null) {
    const currentWeek = isoWeek(weekMondayToday());
    const weeksUntil = ((stored - currentWeek) + 52) % 52;
    if (weeksUntil > 26) {
      const nextMondayISO = new Date(Date.parse(`${weekMondayToday()}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10);
      const label = weekLabel(nextMondayISO); // "Uge N, YYYY" — entydigt år
      await prisma.subscription.update({ where: { id: pk }, data: { startWeek: label, nextWeek: label } });
    }
  }
  await generateForSubscriptionId(pk);
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
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
  const values = { startWeek: p.startWeek, baseInterval: p.baseInterval, fixedEmployee: p.fixedEmployee };
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet.", values };

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
          baseInterval: p.baseInterval, startWeek: p.startWeek, nextWeek,
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
  // Lead-beregner (Thomas, 2026-09-03): sikr at kunden er registreret som
  // erhvervelse (privat/virksomhed), hvis ikke allerede — best effort.
  try {
    const contact = await prisma.contact.findUnique({ where: { id: p.contactId }, select: { isCompany: true } });
    if (contact) {
      await prisma.leadAcquisition.upsert({
        where: { contactId_category: { contactId: p.contactId, category: contact.isCompany ? "virksomhed" : "privat" } },
        create: { companyId: 1, contactId: p.contactId, category: contact.isCompany ? "virksomhed" : "privat", source: "Direkte" },
        update: {},
      });
      revalidatePath("/business-manager/leads");
    }
  } catch { /* best effort */ }
  await generateForSubscriptionId(subId); // materialise its upcoming orders
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  revalidatePath(`/customers/${p.contactId}`);
  redirect(`/subscriptions/${subDisplayNo}`);
}

export async function updateSubscription(pk: number, _prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  await guardAction();
  const p = parse(formData);
  if ("error" in p) return p;
  const values = { startWeek: p.startWeek, baseInterval: p.baseInterval, fixedEmployee: p.fixedEmployee };
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet.", values };
  const nextWeek = p.lines.map((l) => l.nextWeek).find(Boolean) || p.startWeek || null;

  await prisma.$transaction([
    prisma.taskLine.deleteMany({ where: { subscriptionId: pk } }),
    prisma.subscription.update({
      where: { id: pk },
      data: {
        contactId: p.contactId,
        deliveryAddress: contact.city ? `${contact.street}, ${contact.city}` : contact.street,
        baseInterval: p.baseInterval, startWeek: p.startWeek, nextWeek,
        fixedEmployee: p.fixedEmployee, tasks: { create: taskCreate(p.lines) },
      },
    }),
  ]);

  // Propagate authoritative recurrence to all future pending materialisations,
  // including legacy locked imports whose cadence may otherwise stay stale.
  await regenerateFutureOrders(pk);
  const sub = await prisma.subscription.findUnique({ where: { id: pk }, select: { displayNo: true, contactId: true } });
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  if (sub) revalidatePath(`/customers/${sub.contactId}`);
  redirect(`/subscriptions/${sub?.displayNo ?? ""}`);
}
