"use server";

// Server actions for the Emner (leads) register: advance a lead's status and
// convert it into a real Contact + et AFVENTENDE abonnement bygget af
// tilbudsmotorens payload (godkendes efter bekræftelses-opkaldet). All guarded —
// anonymous callers bounce to /login (see lib/api-auth).
import { prisma, isUniqueViolation } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { categoryColor } from "@/lib/categories";
import { weekLabel } from "@/lib/weeks";
import { weekMondayToday } from "@/lib/calendar";
import { parseLeadPayload, beregn, medRabatkode, type LeadPayload, type PricedService } from "@/lib/tilbudsmotor-pricing";
import { leadTilKanal } from "@/lib/lead-calc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Tilbudsmotor-service-id → CRM-kategori (styrer farve-chippen på opgavelinjer). */
const TM_KATEGORI: Record<string, string> = {
  vinduer: "Vinduespudsning", vinduerind: "Vinduespudsning", ovenlys: "Vinduespudsning",
  solcelle: "Vinduespudsning", drivhus: "Vinduespudsning",
  alge: "Algebehandling", algeflis: "Algebehandling",
  tagrender: "Tagrenderens",
  ukrudt: "Ukrudtsbekæmpelse", ukrudt_sproejt: "Ukrudtsbekæmpelse", ukrudt_fjern: "Ukrudtsbekæmpelse",
  fliserens: "Overfladerens", husgarage: "Overfladerens",
  haek: "Grøn service", green: "Grøn service", beskaering: "Grøn service",
  stub: "Grøn service", sammenriv: "Grøn service",
  haveaffald: "Grøn service", sedum: "Grøn service", sne: "Andet", robot: "Andet", service: "Andet",
};

/** Rabat-faktor for hele payloadet: aarNet/aarBrutto efter SAMME rabatkæde som
 *  tilbudsmailen (beregn() → mængderabat, medRabatkode() → rabatkode oven på,
 *  se app/api/slack/interactions/route.ts). Linjepriserne i det afventende
 *  abonnement/ordren skaleres med faktoren, så årssummen matcher det tilbud
 *  kunden accepterede — ellers faktureres brutto (op til ~31 % for meget). */
function rabatFaktor(payload: LeadPayload): number {
  const r = beregn(payload.services);
  if (r.aarBrutto <= 0) return 1;
  const kodePct = payload.rabatOk && payload.rabatPct ? payload.rabatPct : 0;
  const { aarNet } = medRabatkode(r, kodePct);
  return aarNet / r.aarBrutto;
}

/** Pris pr. besøg for én linje, efter rabat-faktoren. */
function linjePris(s: PricedService, faktor: number): number {
  return s.pris != null && Number.isFinite(s.pris) ? Math.max(0, Math.round(s.pris * Math.max(0, Math.round(s.qty)) * faktor)) : 0;
}

/** Byg abonnements-spec fra tilbudsmotorens payload. Frekvens-mapping:
 *  basis-interval = den hyppigste service (52/maxFreq uger, jævnt fordelt);
 *  øvrige services bundtes på samme besøg via per-task multiplier
 *  ("Hver M. gang", M = maxFreq/freq) — samme model som tilbudsmotorens
 *  beregner ("ydelser bundtes på samme besøg"). freq 0 → "På anmodning". */
function subscriptionSpecFromPayload(payload: LeadPayload) {
  const services = payload.services;
  if (!services.length) return null;

  const freqs = services.map((s) => Math.max(0, Math.round(s.freq)));
  // Kun PRISSATTE linjer driver basis-intervallet — en gratis tillægslinje med
  // høj frekvens (fx sne "efter behov") må ikke forvride alle betalte linjers
  // besøgstal (og dermed faktureringen) for hele abonnementet.
  const pricedFreqs = services
    .filter((s) => s.pris != null && Number.isFinite(s.pris) && s.pris > 0 && Math.round(s.freq) > 0)
    .map((s) => Math.max(0, Math.round(s.freq)));
  const maxFreq = Math.max(1, ...(pricedFreqs.length ? pricedFreqs : freqs));
  const baseN = Math.min(52, Math.max(1, Math.round(52 / maxFreq)));
  const baseInterval = baseN === 1 ? "Hver uge" : `Hver ${baseN}. uge`;
  // Faktisk antal besøg pr. år ved dette interval (52/baseN er sjældent præcis
  // maxFreq pga. afrunding: 12×/år → "Hver 4. uge" → 13 besøg). Linjeprisen
  // skaleres med lovet/faktisk besøgstal, så ÅRSSUMMEN rammer det accepterede
  // tilbud uanset afrundingen — ellers over-/underfaktureres kunden med op til
  // ±8-28 % i forhold til tilbudsmailens aarNet.
  const visitsPerYear = 52 / baseN;

  // Start i næste uge — gemmes med ÅRSTAL ("Uge N, YYYY"), så en passeret uge
  // aldrig kan fejltolkes som næste års forekomst (uge 35-hændelsen).
  const nextMondayISO = new Date(new Date(`${weekMondayToday()}T00:00:00Z`).getTime() + 7 * 864e5)
    .toISOString().slice(0, 10);
  const startWeek = weekLabel(nextMondayISO);

  const faktor = rabatFaktor(payload);
  const lines = services.map((s, i) => {
    const f = freqs[i];
    const m = f > 0 ? Math.max(1, Math.round(maxFreq / f)) : null;
    // Skalér pr. besøg: lovet f besøg/år, faktisk (52/baseN)/m — så
    // pris_pr_besøg × faktiske besøg = pris × qty × f × faktor = tilbuddets årssum.
    const actualVisits = m != null ? visitsPerYear / m : 0;
    const skala = actualVisits > 0 ? f / actualVisits : 1;
    const category = TM_KATEGORI[s.id] ?? "Andet";
    const qty = Math.max(0, Math.round(s.qty));
    return {
      category, letter: (category[0] ?? "A").toUpperCase(), color: categoryColor(category),
      description: `${s.navn.trim()}${qty > 0 && s.enhed ? ` — ${qty} ${s.enhed}` : ""}`,
      price: linjePris(s, faktor * skala),
      durationMin: 0,
      intervalMultiplier: m == null ? "På anmodning" : m === 1 ? "Hver gang" : `Hver ${m}. gang`,
      startWeek: null as string | null, isStandardTask: false, sort: i,
    };
  });
  return { baseInterval, startWeek, lines };
}

/** Byg en engangs-ordre-spec fra tilbudsmotorens payload (betaling: "pr_gang").
 *  Én linje pr. valgt service, prissat pr. besøg (pris × qty × rabat-faktor —
 *  IKKE ganget med freq, da det her kun er ÉT besøg, ikke et helt års rytme). */
function orderSpecFromPayload(payload: LeadPayload) {
  const services = payload.services;
  if (!services.length) return null;

  const nextMondayISO = new Date(new Date(`${weekMondayToday()}T00:00:00Z`).getTime() + 7 * 864e5)
    .toISOString().slice(0, 10);

  const faktor = rabatFaktor(payload);
  const lines = services.map((s, i) => {
    const category = TM_KATEGORI[s.id] ?? "Andet";
    const qty = Math.max(0, Math.round(s.qty));
    return {
      category, letter: (category[0] ?? "A").toUpperCase(), color: categoryColor(category),
      description: `${s.navn.trim()}${qty > 0 && s.enhed ? ` — ${qty} ${s.enhed}` : ""}`,
      price: linjePris(s, faktor),
      durationMin: 0, sort: i,
    };
  });
  return { plannedAt: new Date(`${nextMondayISO}T10:00:00Z`), lines };
}

/** Opret en AFVENTENDE engangs-ordre (status "Afventer levering", sourceType
 *  "manual" — samme kategori som andre håndoprettede ordrer i /orders) fra
 *  leadets payload, når kunden har valgt "betal pr. gang" i splittesten frem
 *  for abonnement. Ordre-modellen har intet pending-felt, så "afventer
 *  godkendelse" markeres i kommentaren (vises i /orders, på ordresiden og i
 *  dagsprogrammet), så den ikke leveres før bekræftelses-opkaldet. */
async function createPendingOrder(spec: NonNullable<ReturnType<typeof orderSpecFromPayload>>, contactId: number, deliveryAddress: string): Promise<void> {
  await prisma.order.create({
    data: {
      contactId, deliveryAddress, plannedAt: spec.plannedAt,
      sourceType: "manual", status: "Afventer levering",
      comment: "AFVENTER GODKENDELSE: Oprettet fra lead-konvertering (betal pr. gang) — ring og bekræft tid og pris med kunden, før ordren leveres.",
      tasks: { create: spec.lines },
    },
  });
}

/** Opret et AFVENTENDE abonnement (active=false, pending=true) fra leadets
 *  payload — samme displayNo-retry-mønster som createSubscription. Returnerer
 *  displayNo. */
async function createPendingSubscription(spec: NonNullable<ReturnType<typeof subscriptionSpecFromPayload>>, contactId: number, deliveryAddress: string): Promise<number> {
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

export type ConvertLeadResult =
  | { ok: true; contactId: number; alreadyConverted: boolean }
  | { ok: false; error: string };

/** Kernen i lead→kunde-konverteringen, uden auth-guard og uden redirect — så
 *  den kan genbruges både fra CRM-knappen (convertLead nedenfor) og fra
 *  quote-response-routen (kunden klikkede Ja i tilbudsmailen).
 *
 *  IDEMPOTENT: status-skiftet til "converted" claimes ATOMISK (updateMany med
 *  status-betingelse i where — samme mønster som consumeQuoteToken), så
 *  kombinationen "manuel konvertering i CRM'et + senere Ja tak-klik i mailen"
 *  (eller to samtidige klik) aldrig opretter dublet-abonnement/-ordre: kun den
 *  request der vinder claimet materialiserer payloadet; taberen returnerer blot
 *  den eksisterende contactId. */
export async function convertLeadCore(id: number): Promise<ConvertLeadResult> {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return { ok: false, error: "Emnet findes ikke længere." };

  // Tilbudsmotorens payload: betalingsvalg (splittest), kundetype og services.
  const payload = parseLeadPayload(lead.payload);
  const spec = payload.betaling === "pr_gang"
    ? { kind: "order" as const, order: orderSpecFromPayload(payload) }
    : { kind: "subscription" as const, subscription: subscriptionSpecFromPayload(payload) };
  const harPakkevalg = spec.kind === "order" ? spec.order != null : spec.subscription != null;

  const { street, city } = splitAddress(lead.address ?? "");
  let deliveryAddress = city ? `${street}, ${city}` : street || (lead.address ?? "").trim();
  if (!deliveryAddress && lead.contactId) {
    // Forhåndslinkede leads mangler ofte adresse på selve leadet — fald tilbage
    // til den eksisterende kundes adresse.
    const c = await prisma.contact.findUnique({ where: { id: lead.contactId }, select: { street: true, city: true } });
    if (c) deliveryAddress = c.city ? `${c.street}, ${c.city}` : c.street;
  }

  // Uden adresse kan pakkevalget ikke materialiseres — FEJL med tydelig besked
  // i stedet for et stille datatab (kunden ville tro bestillingen var oprettet).
  if (harPakkevalg && !deliveryAddress) {
    return { ok: false, error: `Emnet fra ${lead.name} mangler en adresse — tilføj den, før emnet konverteres (ellers mistes pakkevalget).` };
  }

  let contactId: number;
  if (lead.contactId) {
    contactId = lead.contactId;
    // Atomisk claim: kun den request der flipper status væk fra "converted"
    // må materialisere payloadet.
    const claim = await prisma.lead.updateMany({
      where: { id, status: { not: "converted" } },
      data: { status: "converted" },
    });
    if (claim.count === 0) return { ok: true, contactId, alreadyConverted: true };
  } else {
    const company = await prisma.company.findFirst();
    if (!company) return { ok: false, error: "Ingen firmaopsætning i CRM'et — emnet kan ikke konverteres." };

    // Tilbudsmotorens kundetype følger med over: erhverv → firmakunde med
    // companyName sat (ellers står redigeringsformularens navnefelter tomme).
    const isCompany = payload.kundetype === "erhverv";

    const claimedContactId = await prisma.$transaction(async (tx) => {
      const claim = await tx.lead.updateMany({
        where: { id, status: { not: "converted" }, contactId: null },
        data: { status: "converted" },
      });
      if (claim.count === 0) return null;
      const c = await tx.contact.create({
        data: {
          companyId: company.id, name: lead.name,
          companyName: isCompany ? lead.name : null,
          email: lead.email, phone: lead.phone, street, city, isCompany,
        },
      });
      await tx.lead.update({ where: { id }, data: { contactId: c.id } });
      return c.id;
    });
    if (claimedContactId == null) {
      // Tabte kapløbet mod en samtidig konvertering — genbrug vinderens kunde.
      const fresh = await prisma.lead.findUnique({ where: { id }, select: { contactId: true } });
      if (fresh?.contactId) return { ok: true, contactId: fresh.contactId, alreadyConverted: true };
      return { ok: false, error: "Emnet er allerede konverteret." };
    }
    contactId = claimedContactId;
  }

  // Payload → afventende abonnement, MEDMINDRE kunden har valgt "betal pr.
  // gang" i splittesten — så bliver det i stedet en engangs-ordre. Ukendt/
  // manglende betalingsvalg (ældre leads) bevarer den gamle opførsel: abonnement.
  // Nås kun af claim-vinderen, så der aldrig opstår dubletter. Fejler
  // materialiseringen, RULLES claimet tilbage — ellers står leadet som
  // "converted" uden abonnement/ordre for altid (retry ville melde
  // "allerede konverteret" og aldrig oprette noget).
  try {
    if (spec.kind === "order" && spec.order) await createPendingOrder(spec.order, contactId, deliveryAddress);
    else if (spec.kind === "subscription" && spec.subscription) await createPendingSubscription(spec.subscription, contactId, deliveryAddress);
  } catch {
    const restoreStatus = lead.status !== "converted" ? lead.status : "new";
    await prisma.lead.updateMany({ where: { id, status: "converted" }, data: { status: restoreStatus } });
    return { ok: false, error: `Kunden er oprettet, men pakkevalget kunne ikke materialiseres (midlertidig fejl) — prøv at konvertere emnet igen. Kunde: /customers/${contactId}` };
  }

  // Lead-beregner (Thomas, 2026-09-03): konverteres emnet til kunde, registreres
  // erhvervelsen AUTOMATISK — kategori ud fra pakkevalg/betaling + kundetype,
  // kanal = emnets utm-source mappet til standardkanalerne (leadTilKanal;
  // ingen utm = "Direkte"). Så ryger kunden ind i Lead-beregneren med alt data.
  try {
    const category = spec.kind === "order" ? "privat" : (payload.kundetype === "erhverv" ? "virksomhed" : "privat");
    await prisma.leadAcquisition.upsert({
      where: { contactId_category: { contactId, category } },
      create: { companyId: lead.companyId, contactId, category, source: leadTilKanal(lead) },
      update: {},
    });
    revalidatePath("/business-manager/leads");
  } catch { /* best effort — konverteringen må aldrig fejle pga. Lead-beregneren */ }

  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  return { ok: true, contactId, alreadyConverted: false };
}

/** Convert a lead into a customer + et AFVENTENDE abonnement fra payloaden.
 *  If it is already linked to a Contact, reuse that customer; otherwise create
 *  the Contact and link it. Abonnementet godkendes (aktiveres + ordrer
 *  materialiseres) særskilt efter bekræftelses-opkaldet. CRM-knap-versionen:
 *  guardet + redirecter til kundekortet — eller tilbage til /leads med en
 *  fejlbesked (fx manglende adresse), så intet fejler stille. */
export async function convertLead(id: number): Promise<void> {
  await guardAction();
  const result = await convertLeadCore(id);
  if (!result.ok) redirect(`/leads?fejl=${encodeURIComponent(result.error)}`);
  redirect(`/customers/${result.contactId}`);
}
