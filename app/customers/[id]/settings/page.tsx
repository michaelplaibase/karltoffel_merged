import { notFound } from "next/navigation";
import { getContactSettings } from "@/lib/queries";
import { updateContactSettings } from "@/app/actions/contacts";
import ContactSettingsForm from "@/components/ContactSettingsForm";

export const metadata = { title: "Kundeindstillinger · Karltoffel" };

export default async function ContactSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contactId = Number(id);
  const s = await getContactSettings(contactId);
  if (!s) notFound();

  return (
    <ContactSettingsForm
      action={updateContactSettings.bind(null, contactId)}
      name={s.name}
      initial={s}
      cancelHref={`/customers/${contactId}`}
    />
  );
}
