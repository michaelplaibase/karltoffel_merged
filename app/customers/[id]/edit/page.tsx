import { notFound } from "next/navigation";
import { getContactEditData } from "@/lib/queries";
import { updateContact } from "@/app/actions/contacts";
import ContactForm from "@/components/ContactForm";

export const metadata = { title: "Rediger kontakt · Karltoffel" };

export default async function EditContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contactId = Number(id);
  const initial = await getContactEditData(contactId);
  if (!initial) notFound();

  return (
    <ContactForm
      action={updateContact.bind(null, contactId)}
      initial={initial}
      title="Rediger kontaktinfo"
      submitLabel="Gem ændringer"
      cancelHref={`/customers/${contactId}`}
    />
  );
}
