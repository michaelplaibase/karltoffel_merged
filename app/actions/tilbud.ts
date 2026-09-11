"use server";

// Server actions for Tilbud-modulet (Thomas, 2026-09-11): opret tilbud (med
// eksisterende ELLER ny kunde i samme flow), send med PDF, markér accepteret
// manuelt, og konvertér til abonnement — sidstnævnte genbruger abonnements-
// flowet (displayNo-allokering, TaskLine-felter og pending-godkendelse som
// app/actions/subscriptions.ts og lead-konverteringen).
import { prisma, isUniqueViolation } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { categoryColor } from "@/lib/categories";
import { weekLabel, mondayOf, isoWeekYear } from "@/lib/weeks";
import { isoWeek } from "@/lib/planner";
import { parseWeekLabelParts } from "@/lib/recurrence";
import { nyAcceptToken } from "@/lib/tilbud.mts";
import { parseBaseIntervalWeeks } from "@/lib/subscription-intervals";
import { sendTilbudMail } from "@/lib/tilbud-send";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type TilbudState = { error?: string; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Samme format som tilbud-niveau startuge ('Uge 29' / 'Uge 29, 2026').
const UGE_RE = /^Uge\s+\d{1,2}(,\s*\d{4})?$/i;

function readLines(formData: FormData) {
  const descs = formData.getAll("taskDescription").map(String);
  const prices = formData.getAll("taskPrice").map((v) => Number(v) || 0);
  // Thomas, 2026-09-11 (korrektion): valgfrit interval PR. LINJE — samme
  // muligheder som abonnementet (BASE_INTERVALS), tom = engangsopgave.
  const intervals = formData.getAll("taskInterval").map(String);
  // Thomas, 2026-09-11 (korrektion 2): valgfri STARTUGE PR. LINJE — samme
  // format som tilbud-niveau startuge; tom = arver tilbud-niveau startugen.
  const startWeeks = formData.getAll("taskStartWeek").map(String);
  return descs
    .map((d, i) => ({
      description: d.trim(),
      price: prices[i] || 0,
      interval: (intervals[i] ?? "").trim() || null,
      startWeek: (startWeeks[i] ?? "").trim() || null,
    }))
    .filter((l) => l.description);
}

/** Split "Ørnedvej 4, 8660 Skanderborg" → { street, city } (samme format som
 *  contacts.ts gemmer: street = "Ørnedvej 4", city = "8660 Skanderborg"). */
function splitAddress(raw: string): { street: string; city: string } {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && /^\d{4}\s/.test(parts[parts.length - 1])) {
    return { street: parts.slice(0, -1).join(", "), city: parts[parts.length - 1] };
  }
  return { street: raw.trim(), city: "" };
}

/** Opret et tilbud: vælg eksisterende kunde (contactId) eller opret ny kunde i
 *  samme flow (newCustomer=1 + felter). Redirekter til tilbuddet. */
export async function createTilbud(_prev: TilbudState, formData: FormData): Promise<TilbudState> {
  await guardAction();
  const title = String(formData.get("title") ?? "").trim() || "Tilbud";
  const note = String(formData.get("note") ?? "").trim() || null;
  // Valgfrie planlægningsfelter (Thomas, 2026-09-11): tomme = udelades af PDF
  // og ignoreres ved konvertering.
  const startWeekRaw = String(formData.get("startWeek") ?? "").trim();
  const UGE_RE = /^Uge\s+\d{1,2}(,\s*\d{4})?$/i;
  if (startWeekRaw && !UGE_RE.test(startWeekRaw)) {
    return { error: "Startuge skal skrives som fx 'Uge 29' eller 'Uge 29, 2026' — eller lades tom." };
  }
  const startWeek = startWeekRaw || null;
  const baseIntervalRaw = String(formData.get("baseInterval") ?? "").trim();
  const baseInterval = baseIntervalRaw || null;
  const lines = readLines(formData);
  if (!lines.length) return { error: "Tilføj mindst én opgavelinje med en pris." };
  // Thomas, 2026-09-11 (korrektion 2): valider startuge pr. linje med samme
  // format som tilbud-niveau startuge.
  for (const l of lines) {
    if (l.startWeek && !UGE_RE.test(l.startWeek)) {
      return { error: `Startuge for '${l.description}' skal skrives som fx 'Uge 29' eller 'Uge 29, 2026' — eller lades tom.` };
    }
  }

  let contactId = Number(formData.get("contactId")) || 0;
  if (!contactId && formData.get("newCustomer") === "1") {
    const navn = String(formData.get("newName") ?? "").trim();
    const adresse = String(formData.get("newAddress") ?? "").trim();
    if (!navn) return { error: "Angiv kundens navn." };
    if (!adresse) return { error: "Angiv kundens adresse." };
    const company = await prisma.company.findFirst();
    if (!company) return { error: "Ingen virksomhed fundet." };
    const { street, city } = splitAddress(adresse);
    const isCompany = formData.get("newIsCompany") === "1";
    const contact = await prisma.contact.create({
      data: {
        companyId: company.id,
        isCompany,
        companyName: isCompany ? navn : null,
        name: navn,
        email: String(formData.get("newEmail") ?? "").trim() || null,
        phone: String(formData.get("newPhone") ?? "").trim() || null,
        street,
        city,
      },
    });
    contactId = contact.id;
    revalidatePath("/customers");
  }
  if (!contactId) return { error: "Vælg en kunde." };
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { id: true } });
  if (!contact) return { error: "Kunden blev ikke fundet." };

  const created = await prisma.tilbud.create({
    data: {
      contactId, title, note, acceptToken: nyAcceptToken(), startWeek, baseInterval,
      lines: { create: lines.map((l, i) => ({ description: l.description, price: l.price, interval: l.interval, startWeek: l.startWeek, sort: i })) },
    },
  });
  revalidatePath("/tilbud");
  redirect(`/tilbud/${created.id}`);
}

/** Send tilbuddet til kunden med branded PDF (hej@karltoffel.dk). */
export async function sendTilbud(_prev: TilbudState, formData: FormData): Promise<TilbudState> {
  await guardAction();
  const tilbudId = Number(formData.get("tilbudId"));
  const to = String(formData.get("to") ?? "").trim();
  const besked = String(formData.get("besked") ?? "").trim();
  if (!tilbudId) return { error: "Ugyldigt tilbud." };
  if (!EMAIL_RE.test(to)) return { error: "Angiv en gyldig e-mailadresse." };
  if (!besked) return { error: "Beskeden er tom." };
  try {
    const res = await sendTilbudMail({ tilbudId, to, besked });
    if (!res.ok) return { error: res.error };
    revalidatePath(`/tilbud/${tilbudId}`);
    revalidatePath("/tilbud");
    return { message: `Tilbud sendt til ${to}.` };
  } catch (e) {
    console.error("[tilbud] send fejlede:", e);
    return { error: "Afsendelsen fejlede — prøv igen." };
  }
}

/** Acceptvej A: holdet markerer manuelt "kunde har accepteret". */
export async function markTilbudAccepted(tilbudId: number): Promise<void> {
  await guardAction();
  await prisma.tilbud.updateMany({
    where: { id: tilbudId, status: { in: ["sendt", "udkast", "afvist"] } },
    data: { status: "accepteret", acceptedAt: new Date(), acceptMethod: "manuelt" },
  });
  revalidatePath(`/tilbud/${tilbudId}`);
  revalidatePath("/tilbud");
}

/** Konvertér et accepteret tilbud til et abonnement (pending — holdet sætter
 *  intervaller på opgaverne bagefter i det almindelige abonnementsflow). */
export async function convertTilbudToSubscription(tilbudId: number): Promise<void> {
  await guardAction();
  const tilbud = await prisma.tilbud.findUnique({
    where: { id: tilbudId },
    include: {
      lines: { orderBy: { sort: "asc" }, select: { description: true, price: true, interval: true, startWeek: true } },
      contact: { select: { id: true, street: true, city: true } },
    },
  });
  if (!tilbud) return;
  if (tilbud.status !== "accepteret") return;
  if (tilbud.convertedSubscriptionId) return; // aldrig dublet-konvertering

  const contact = tilbud.contact;
  const deliveryAddress = contact.city ? `${contact.street}, ${contact.city}` : contact.street;
  // Thomas, 2026-09-11: hvis tilbuddet har startuge/interval udfyldt, forudfyller
  // de abonnementet — ellers som hidtil (nuværende uge + default-interval).
  // Årløs uge der er passeret = start nu (samme semantik som normalizeWeekLabel
  // i subscriptions.ts); fremtidig uge skrives med eksplicit år.
  const normalizeStartWeek = (label: string | null): string | null => {
    const parts = parseWeekLabelParts(label ?? "");
    if (!parts) return null;
    return parts.year != null
      ? `Uge ${parts.week}, ${parts.year}`
      : (parts.week >= isoWeek(nowMonday) ? `Uge ${parts.week}, ${isoWeekYear(nowMonday)}` : weekLabel(nowMonday));
  };
  const nowMonday = mondayOf(new Date()).toISOString().slice(0, 10);
  let startWeek = weekLabel(nowMonday);
  const tilbudStartWeek = normalizeStartWeek(tilbud.startWeek);
  if (tilbudStartWeek) startWeek = tilbudStartWeek;
  // Thomas, 2026-09-11 (korrektion 2): startuge er også SAT PR. OPGAVELINJE.
  // Linjens startuge følger med til den enkelte TaskLine (samme normalisering
  // som abonnementets startuge); linjer UDEN startuge falder tilbage til
  // tilbud-niveau startugen — som før.
  const linjeStartUger = tilbud.lines.map((l) => normalizeStartWeek(l.startWeek) ?? tilbudStartWeek ?? null);
    // Thomas, 2026-09-11 (korrektion): interval er nu SAT PR. OPGAVELINJE.
    // Hvert linje-interval følger med til den enkelte TaskLine (ikke ét fælles
    // interval): uge-intervallet "Hver 6. uge" oversættes til abonnements-
    // multiplikatoren "Hver 6. gang" med basis-interval "Hver uge" — samme
    // matematik som lib/lead-calc (stepWeeks = base × multiplier). Linjer uden
    // interval er engangsopgaver og får "Hver gang" (holdet justerer bagefter —
    // abonnementet oprettes pending).
    const linjeIntervaller = tilbud.lines.map((l) => l.interval?.trim() || null);
    const harLinjeIntervaller = linjeIntervaller.some(Boolean);
    let baseInterval: string;
    let linjeMultiplikatorer: string[];
    if (harLinjeIntervaller) {
      baseInterval = "Hver uge";
      linjeMultiplikatorer = linjeIntervaller.map((iv) => {
        const uger = parseBaseIntervalWeeks(iv);
        return uger != null ? `Hver ${uger}. gang` : "Hver gang";
      });
    } else {
      baseInterval = tilbud.baseInterval?.trim() || "Hver 2. uge";
      linjeMultiplikatorer = tilbud.lines.map(() => "Hver gang");
    }
  const lines = tilbud.lines.length
    ? tilbud.lines
    : [{ description: "Serviceaftale", price: 0 }]; // sikkerhedsnet — TaskLine kræver >= 1 linje

  // DisplayNo-allokering med retry — samme mønster som createSubscription.
  for (let attempt = 0; ; attempt++) {
    const max = await prisma.subscription.aggregate({ _max: { displayNo: true } });
    const displayNo = (max._max.displayNo ?? 235800) + 1;
    try {
      const sub = await prisma.subscription.create({
        data: {
          displayNo,
          contactId: contact.id,
          deliveryAddress,
          baseInterval, // fra tilbuddet hvis udfyldt — holdet justerer bagefter
          startWeek,
          pending: true,
          active: false,
          tasks: {
            create: lines.map((l, i) => ({
              category: "Andet",
              letter: "A",
              color: categoryColor("Andet"),
              description: l.description,
              price: l.price,
              durationMin: 60,
              intervalMultiplier: linjeMultiplikatorer[i] ?? "Hver gang",
              startWeek: linjeStartUger[i] ?? null,
            })),
          },
        },
      });
      await prisma.tilbud.update({
        where: { id: tilbudId, convertedSubscriptionId: null },
        data: { status: "konverteret", convertedSubscriptionId: sub.id },
      });
      revalidatePath("/subscriptions");
      revalidatePath("/tilbud");
      revalidatePath(`/tilbud/${tilbudId}`);
      redirect(`/subscriptions/${sub.displayNo}`);
      return;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
}

export async function deleteTilbud(tilbudId: number): Promise<void> {
  await guardAction();
  await prisma.tilbud.deleteMany({ where: { id: tilbudId, status: "udkast" } });
  revalidatePath("/tilbud");
  redirect("/tilbud");
}