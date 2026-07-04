"use server";

// Server actions for the contact (Kontakt) create/edit flow. Invoked from
// <form action={…}> in components/ContactForm. Single-tenant for now: writes
// attach to the one seeded Company. Auth is a later phase (see the goal TODO).
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ContactFormState = { error?: string };

/** The UI keeps one free-text address ("Vejnavn husnr., postnr. by"); the model
 *  stores street + city split on the first comma (matching the seeded shape). */
function splitAddress(addr: string): { street: string; city: string } {
  const i = addr.indexOf(",");
  if (i === -1) return { street: addr.trim(), city: "" };
  return { street: addr.slice(0, i).trim(), city: addr.slice(i + 1).trim() };
}

type Parsed = {
  isCompany: boolean; companyName: string; cvr: string; ean: string;
  navn: string; email: string; phone: string; address: string; note: string;
};
function parse(formData: FormData): Parsed {
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
function toData(f: Parsed) {
  const displayName = f.isCompany ? (f.companyName || f.navn) : f.navn;
  return {
    isCompany: f.isCompany,
    companyName: f.isCompany ? (f.companyName || f.navn) || null : null,
    cvr: f.cvr || null,
    ean: f.ean || null,
    name: displayName,
    att: f.isCompany ? (f.navn || null) : null,
    email: f.email || null,
    phone: f.phone || null,
    ...splitAddress(f.address),
    note: f.note || null,
  };
}

export async function createContact(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const f = parse(formData);
  const data = toData(f);
  if (!data.name) return { error: "Angiv et navn." };
  const company = await prisma.company.findFirst();
  if (!company) return { error: "Ingen virksomhed fundet." };
  const created = await prisma.contact.create({ data: { companyId: company.id, ...data } });
  revalidatePath("/customers");
  redirect(`/customers/${created.id}`);
}

/** Delete a customer and everything attached to it (orders, subscriptions,
 *  fixed-price agreements and their task lines) in one transaction. */
export async function deleteContact(id: number): Promise<void> {
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
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateContactSettings(id: number, _prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
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
  const f = parse(formData);
  const data = toData(f);
  if (!data.name) return { error: "Angiv et navn." };
  await prisma.contact.update({ where: { id }, data });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}
