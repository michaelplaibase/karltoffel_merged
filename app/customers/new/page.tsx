import { createContact } from "@/app/actions/contacts";
import ContactForm from "@/components/ContactForm";

export const metadata = { title: "Opret ny kontakt · Karltoffel" };

export default function NewContact() {
  return (
    <ContactForm
      action={createContact}
      title="Opret ny kontakt"
      submitLabel="Opret kontakt"
      cancelHref="/customers"
    />
  );
}
