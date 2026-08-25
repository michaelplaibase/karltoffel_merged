"use server";

// Server actions for the contact (Kontakt) create/edit flow. Invoked from
// <form action={…}> in components/ContactForm. Single-tenant for now: writes
// attach to the one seeded Company. Auth is a later phase (see the goal TODO).
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// `values` ekkoer de indsendte felter ved fejl (samme mønster som
// CompleteOrderState i app/actions/orders.ts): React 19 nulstiller
// ukontrollerede felter når en form-action returnerer, så ContactForm
// prefiller defaultValue fra state.values — brugerens indtastning må aldrig
// gå tabt ved en valideringsfejl.
export type ContactFormValues = {
  isCompany: boolean; companyName: string; cvr: string; ean: string;
  navn: string; email: string; phone: string; address: string; note: string;
};
export type ContactFormState = { error?: string; values?: ContactFormValues };

/** The UI keeps one free-text address ("Vejnavn husnr., postnr. by"); the model
 *  stores street + city split on the first comma (matching the seeded shape). */
function splitAddress(addr: string): { street: string; city: string } {
  const i = addr.indexOf(",");
  if (i === -1) return { street: addr.trim(), city: "" };
  return { street: addr.slice(0, i).trim(), city: addr.slice(i + 1).trim() };
}

/** Normaliser telefonnummer til rene cifre uden +45-præfiks ("12 34 56 78" og
 *  "+45 12345678" → "12345678") — samme regel som lead-indtaget, så
 *  telefonsøgning matcher på tværs. Dubleret fra scripts/normalize-phones.ts
 *  (scripts/ må ikke importeres fra app-kode). */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("45") ? digits.slice(2) : digits;
}

function parse(formData: FormData): ContactFormValues {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    isCompany: formData.get("isCompany") === "on",
    companyName: s("companyName"), cvr: s("cvr"), ean: s("ean"),
    navn: s("name"), email: s("email"), phone: s("phone"),
    address: s("address"), note: s("note"),
  };
}

/** Map the form onto the Contact columns. For a company the business name is the
 *  primary display (matches the customer list), and "Navn" is the contact person
 *  (att). For a private contact "Navn" is the display name. */
function toData(f: ContactFormValues) {
  const displayName = f.isCompany ? (f.companyName || f.navn) : f.navn;
  return {
    isCompany: f.isCompany,
    companyName: f.isCompany ? (f.companyName || f.navn) || null : null,
    cvr: f.cvr || null,
    ean: f.ean || null,
    name: displayName,
    att: f.isCompany ? (f.navn || null) : null,
    email: f.email || null,
    phone: normalizePhone(f.phone) || null,
    ...splitAddress(f.address),
    note: f.note || null,
  };
}

export async function createContact(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  await guardAction();
  const f = parse(formData);
  const data = toData(f);
  if (!data.name) return { error: "Angiv et navn.", values: f };
  // En kontakt uden adresse kan ikke bruges i marken (kort, kalender, ordrer) —
  // blokér i stedet for at gemme tomt, og bevar indtastningen i formularen.
  if (!data.street) return { error: "Angiv en adresse.", values: f };
  const company = await prisma.company.findFirst();
  if (!company) return { error: "Ingen virksomhed fundet.", values: f };
  const created = await prisma.contact.create({ data: { companyId: company.id, ...data } });
  revalidatePath("/customers");
  redirect(`/customers/${created.id}`);
}

/** Delete a customer and everything attached to it (orders, subscriptions,
 *  fixed-price agreements and their task lines) in one transaction. */
export async function deleteContact(id: number): Promise<void> {
  await guardAction();
  await prisma.$transaction([
    prisma.taskLine.deleteMany({ where: { OR: [
      { order: { contactId: id } },
      { subscription: { contactId: id } },
      { fixedPrice: { contactId: id } },
    ] } }),
    prisma.order.deleteMany({ where: { contactId: id } }),
    prisma.subscription.deleteMany({ where: { contactId: id } }),
    prisma.fixedPriceAgreement.deleteMany({ where: { contactId: id } }),
    prisma.contact.delete({ where: { id } }),
  ]);
  // Sletningen fjerner ordrer/abonnementer/fastprisaftaler — revalider alle de
  // flader der viser dem, ikke kun kundelisten (samme konvention som deleteOrder).
  revalidatePath("/customers");
  revalidatePath("/orders");
  revalidatePath("/subscriptions");
  revalidatePath("/fixed-prices");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  redirect("/customers");
}

export async function updateContactSettings(id: number, _prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  await guardAction();
  await prisma.contact.update({
    where: { id },
    data: {
      skipDeliveryAddressOnInvoice: formData.get("skipDeliveryAddressOnInvoice") === "on",
      showDeliveryNameOnInvoice: formData.get("showDeliveryNameOnInvoice") === "on",
      skipInvoiceOverSms: formData.get("skipInvoiceOverSms") === "on",
      invoiceChoicePreselect: String(formData.get("invoiceChoicePreselect") ?? "Anvend standardindstilling"),
    },
  });
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function updateContact(id: number, _prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  await guardAction();
  const f = parse(formData);
  const data = toData(f);
  if (!data.name) return { error: "Angiv et navn.", values: f };
  if (!data.street) return { error: "Angiv en adresse.", values: f };

  const before = await prisma.contact.findUnique({ where: { id }, select: { street: true, city: true } });
  if (!before) return { error: "Kontakten findes ikke længere.", values: f };
  await prisma.contact.update({ where: { id }, data });

  // Adresse-propagering — KUN når adressen faktisk er ændret, og KUN til de
  // abonnementer/fastprisaftaler/åbne fremtidige ordrer hvis leveringsadresse
  // fulgte kontaktens gamle adresse (en manuelt afvigende leveringsadresse er
  // et bevidst valg og røres ikke). Eksisterende ordrer OPDATERES i stedet for
  // at blive slettet/genskabt, så manuelle flytninger, låse, medarbejder-
  // tildeling og bemærkninger i kalenderen bevares.
  const oldAddress = before.city ? `${before.street}, ${before.city}` : before.street;
  const newAddress = data.city ? `${data.street}, ${data.city}` : data.street;
  const addressChanged = newAddress !== oldAddress;
  if (addressChanged) {
    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { contactId: id, deliveryAddress: oldAddress },
        data: { deliveryAddress: newAddress },
      }),
      prisma.fixedPriceAgreement.updateMany({
        where: { contactId: id, deliveryAddress: oldAddress },
        data: { deliveryAddress: newAddress },
      }),
      prisma.order.updateMany({
        where: { contactId: id, deliveryAddress: oldAddress, status: "Afventer levering" },
        data: { deliveryAddress: newAddress },
      }),
    ]);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  if (addressChanged) {
    revalidatePath("/subscriptions");
    revalidatePath("/fixed-prices");
    revalidatePath("/orders");
    revalidatePath("/calendar");
    revalidatePath("/daycalendar");
  }
  redirect(`/customers/${id}`);
}
