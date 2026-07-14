import { getContactOptions, getMinuteRate } from "@/lib/queries";
import { createFixedPrice } from "@/app/actions/fixed-prices";
import FixedPriceForm from "@/components/FixedPriceForm";

export const metadata = { title: "Opret fastprisaftale · Karltoffel" };

export default async function NewFixedPrice({ searchParams }: { searchParams: Promise<{ for_contact?: string }> }) {
  const { for_contact } = await searchParams;
  const [contacts, minuteRate] = await Promise.all([getContactOptions(), getMinuteRate()]);
  const initialContactId = for_contact ? Number(for_contact) : undefined;

  return (
    <div className="container-1140">
      <FixedPriceForm
        action={createFixedPrice}
        contacts={contacts}
        initial={initialContactId ? { contactId: initialContactId, tasks: [] } : undefined}
        title="Opret fastprisaftale"
        submitLabel="Opret fastprisaftale"
        minuteRate={minuteRate}
      />
    </div>
  );
}
