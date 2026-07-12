"use server";

// Server actions for the Emner (leads) register: advance a lead's status and
// convert it into a real Contact + et AFVENTENDE abonnement bygget af
// tilbudsmotorens payload (godkendes efter bekræftelses-opkaldet). All guarded —
// anonymous callers bounce to /login (see lib/api-auth).
import { prisma, isUniqueViolation } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { categoryColor } from "@/lib/categories";
import { isoWeek } from "@/lib/planner";
import { weekMondayToday } from "@/lib/calendar";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Tilbudsmotor-service-id → CRM-kategori (styrer farve-chippen på opgavelinjer). */
const TM_KATEGORI: Record<string, string> = {
  vinduer: "Vinduespudsning", vinduerind: "Vinduespudsning", ovenlys: "Vinduespudsning",
  solcelle: "Vinduespudsning", drivhus: "Vinduespudsning",
  alge: "Algebehandling", algeflis: "Algebehandling",
  tagrender: "Tagrenderens",
  ukrudt: "Ukrudtsbekæmpelse",
  fliserens: "Overfladerens", husgarage: "Overfladerens",
  haek: "Grøn service", green: "Grøn service", graes: "Grøn service", beskaering: "Grøn service",
  stub: "Grøn service", sammenriv: "Grøn service",
  haveaffald: "Grøn service", sedum: "Grøn service", sne: "Andet", robot: "Andet", service: "Andet",
};

type TmService = { id?: string; navn?: string; qty?: number; enhed?: string; freq?: number; pris?: number | null };

/** Byg abonnements-spec fra tilbudsmotorens payload. Frekvens-mapping:
 *  basis-interval = den hyppigste service (52/maxFreq uger, jævnt fordelt);
 *  øvrige services bundtes på samme besøg via per-task multiplier
 *  ("Hver M. gang", M = maxFreq/freq) — samme model som tilbudsmotorens
 *  beregner ("ydelser bundtes på samme besøg"). freq 0 → "På anmodning". */
function subscriptionSpecFromPayload(raw: string | null) {
  if (!raw) return null;
  let payload: { services?: TmService[] };
  try { payload = JSON.parse(raw) as { services?: TmService[] }; } catch { return null; }
  const services = (payload.services ?? []).filter((s) => s && typeof s.navn === "string" && s.navn.trim());
  if (!services.length) return null;

  const freqs = services.map((s) => Math.max(0, Math.round(s.freq ?? 0)));
  const maxFreq = Math.max(1, ...freqs);
  const baseN = Math.min(52, Math.max(1, Math.round(52 / maxFreq)));
  const baseInterval = baseN === 1 ? "Hver uge" : `Hver ${baseN}. uge`;

  // Start i næste uge (label-formatet "Uge N" som recurrence-parseren forstår).
  const nextMondayISO = new Date(new Date(`${weekMondayToday()}T00:00:00Z`).getTime() + 7 * 864e5)
    .toISOString().slice(0, 10);
  const startWeek = `Uge ${isoWeek(nextMondayISO)}`;

  const lines = services.map((s, i) => {
    const f = freqs[i];
    const m = f > 0 ? Math.max(1, Math.round(maxFreq / f)) : null;
    const category = TM_KATEGORI[s.id ?? ""] ?? "Andet";
    const qty = Math.max(0, Math.round(s.qty ?? 0));
    return {
      category, letter: (category[0] ?? "A").toUpperCase(), color: categoryColor(category),
      description: `${s.navn!.trim()}${qty > 0 && s.enhed ? ` — ${qty} ${s.enhed}` : ""}`,
      price: s.pris != null && Number.isFinite(s.pris) ? Math.max(0, Math.round(s.pris * qty)) : 0,
      durationMin: 0,
      intervalMultiplier: m == null ? "På anmodning" : m === 1 ? "Hver gang" : `Hver ${m}. gang`,
      startWeek: null as string | null, isStandardTask: false, sort: i,
    };
  });
  return { baseInterval, startWeek, lines };
}

/** Opret et AFVENTENDE abonnement (active=false, pending=true) fra leadets
 *  payload — samme displayNo-retry-mønster som createSubscription. Returnerer
 *  displayNo eller null (intet payload / ingen services). */
async function createPendingSubscription(lead: { payload: string | null; address: string | null }, contactId: number, deliveryAddress: string): Promise<number | null> {
  const spec = subscriptionSpecFromPayload(lead.payload);
  if (!spec) return null;
  for (let attempt = 0; ; attempt++) {
    const max = await prisma.subscription.aggregate({ _max: { displayNo: true } });
    const displayNo = (max._max.displayNo ?? 235800) + 1;
    try {
      const created = await prisma.subscription.create({
        data: {
          displayNo, contactId, deliveryAddress,
          baseInterval: spec.baseInterval, startWeek: spec.startWeek, nextWeek: spec.startWeek,
          fixedEmployee: "Ingen",
          active: false, pending: true,   // afventer godkendelses-opkaldet — ingen ordrer endnu
          tasks: { create: spec.lines },
        },
      });
      return created.displayNo;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
}

/** Same "one free-text address -> street + city on the first comma" split the
 *  contact create flow uses (app/actions/contacts.ts). */
function splitAddress(addr: string): { street: string; city: string } {
  const i = addr.indexOf(",");
  if (i === -1) return { street: addr.trim(), city: "" };
  return { street: addr.slice(0, i).trim(), city: addr.slice(i + 1).trim() };
}

export async function markLeadContacted(id: number): Promise<void> {
  await guardAction();
  await prisma.lead.update({ where: { id }, data: { status: "contacted" } });
  revalidatePath("/leads");
}

export async function rejectLead(id: number): Promise<void> {
  await guardAction();
  await prisma.lead.update({ where: { id }, data: { status: "rejected" } });
  revalidatePath("/leads");
}

/** Convert a lead into a customer + et AFVENTENDE abonnement fra payloaden.
 *  If it is already linked to a Contact, reuse that customer; otherwise create
 *  the Contact and link it. Abonnementet godkendes (aktiveres + ordrer
 *  materialiseres) særskilt efter bekræftelses-opkaldet. */
export async function convertLead(id: number): Promise<void> {
  await guardAction();
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return;

  const { street, city } = splitAddress(lead.address ?? "");

  let contactId: number;
  if (lead.contactId) {
    contactId = lead.contactId;
    await prisma.lead.update({ where: { id }, data: { status: "converted" } });
  } else {
    const company = await prisma.company.findFirst();
    if (!company) return;

    // Tilbudsmotorens kundetype følger med over: erhverv → firmakunde.
    let isCompany = false;
    try { isCompany = lead.payload ? (JSON.parse(lead.payload) as { kundetype?: string }).kundetype === "erhverv" : false; } catch { /* korrupt payload ignoreres */ }

    const contact = await prisma.$transaction(async (tx) => {
      const c = await tx.contact.create({
        data: { companyId: company.id, name: lead.name, email: lead.email, phone: lead.phone, street, city, isCompany },
      });
      await tx.lead.update({ where: { id }, data: { status: "converted", contactId: c.id } });
      return c;
    });
    contactId = contact.id;
  }

  // Payload → afventende abonnement (ingen ordrer før godkendelse).
  const deliveryAddress = city ? `${street}, ${city}` : street || lead.address || "";
  if (deliveryAddress) await createPendingSubscription(lead, contactId, deliveryAddress);

  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  redirect(`/customers/${contactId}`);
}
