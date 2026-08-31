"use server";

// Server actions for fixed-price agreements (Fastprisaftale): create and update,
// including the task-line formset (no interval — a fixed-price agreement has no
// recurrence, only description/category/price/duration per line).
import { prisma, isUniqueViolation } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { categoryColor } from "@/lib/categories";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FixedPriceState = { error?: string };

/** Delete a fixed-price agreement and its task lines. */
export async function deleteFixedPrice(pk: number): Promise<void> {
  await guardAction();
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
  await guardAction();
  const p = parse(formData);
  if ("error" in p) return p;
  const contact = await prisma.contact.findUnique({ where: { id: p.contactId } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  const deliveryAddress = contact.city ? `${contact.street}, ${contact.city}` : contact.street;

  // Allocate "Aftale nr." (displayNo) + insert with retry (see subscriptions.ts).
  let displayNo = 0;
  for (let attempt = 0; ; attempt++) {
    const max = await prisma.fixedPriceAgreement.aggregate({ _max: { displayNo: true } });
    displayNo = (max._max.displayNo ?? 100000) + 1;
    try {
      await prisma.fixedPriceAgreement.create({
        data: { displayNo, contactId: p.contactId, deliveryAddress, tasks: { create: taskCreate(p.lines) } },
      });
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
  revalidatePath("/fixed-prices");
  revalidatePath(`/customers/${p.contactId}`);
  redirect(`/fixed-prices/${displayNo}`);
}

export async function updateFixedPrice(pk: number, _prev: FixedPriceState, formData: FormData): Promise<FixedPriceState> {
  await guardAction();
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

// ---- Planlægning i kalender (ad hoc) ---------------------------------------
// Thomas (2026-08): når en kunde ringer og bestiller opgaven under en
// fastprisaftale, skal den kunne planlægges i kalenderen som ENKELTOPGAVE —
// samme planlægningsflow som abonnementsopgaver (dato + medarbejder), bare
// UDEN interval/gentagelse. Ordren bærer sourceType "fixed" + fixedPriceId,
// så lister viser "Fastprisaftale" og prisjusteringer (funktioner.ts) rammer
// de ikke-lukkede ordrelinjer via ordrens fixedPriceId.

export type FixedPriceScheduleState = { error?: string; values?: { date: string; employeeId: string } };

/** Create ONE ad hoc calendar order from a fixed-price agreement, copying its
 *  task lines (paused template lines are skipped, matching generation logic).
 *  plannedAt følger createOrder-konventionen: Dansk kalenderdato kl. 10 UTC. */
export async function scheduleFixedPrice(pk: number, _prev: FixedPriceScheduleState, formData: FormData): Promise<FixedPriceScheduleState> {
  await guardAction();
  const date = String(formData.get("date") ?? "").trim();
  const employeeIdRaw = String(formData.get("employeeId") ?? "").trim();
  const values = { date, employeeId: employeeIdRaw }; // ekko ved valideringsfejl (React 19 form-reset)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Vælg en gyldig dato.", values };

  const fp = await prisma.fixedPriceAgreement.findUnique({ where: { id: pk }, include: { tasks: true } });
  if (!fp) return { error: "Fastprisaftalen blev ikke fundet.", values };
  const lines = fp.tasks.filter((t) => !t.pauseActive).sort((a, b) => a.sort - b.sort);
  if (!lines.length) return { error: "Fastprisaftalen har ingen opgaver — tilføj mindst én opgave på aftalen først.", values };

  // Medarbejder: samme konvention som createOrder — eksplicit valg, ellers
  // første aktive bruger (planneren ruter kun ordrer med sat employeeId).
  const employeeId = employeeIdRaw
    ? Number(employeeIdRaw) || null
    : (await prisma.user.findFirst({ where: { active: true }, orderBy: { id: "asc" } }))?.id ?? null;

  const order = await prisma.order.create({
    data: {
      contactId: fp.contactId,
      deliveryAddress: fp.deliveryAddress,
      plannedAt: new Date(`${date}T10:00:00Z`),
      sourceType: "fixed",
      fixedPriceId: fp.id,
      employeeId,
      status: "Afventer levering",
      tasks: {
        create: lines.map((t, i) => ({
          category: t.category, letter: t.letter, color: t.color,
          description: t.description, price: t.price, durationMin: t.durationMin, sort: i,
        })),
      },
    },
  });

  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect(`/orders/${order.id}`);
}
