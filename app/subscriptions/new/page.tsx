import { getContactOptions, getEmployeeNames, getEmployeeOptions, getMinuteRate } from "@/lib/queries";
import { createSubscription } from "@/app/actions/subscriptions";
import SubscriptionForm from "@/components/SubscriptionForm";

export const metadata = { title: "Opret abonnement · Karltoffel Business Manager" };

export default async function NewSubscription({ searchParams }: { searchParams: Promise<{ for_contact?: string }> }) {
  const { for_contact } = await searchParams;
  const [contacts, employees, employeeOptions, minuteRate] = await Promise.all([getContactOptions(), getEmployeeNames(), getEmployeeOptions(), getMinuteRate()]);
  const initialContactId = for_contact ? Number(for_contact) : undefined;

  return (
    <div className="container-1140">
      <SubscriptionForm
        action={createSubscription}
        contacts={contacts}
        employees={employees}
        employeeOptions={employeeOptions}
        initial={initialContactId ? { contactId: initialContactId, baseInterval: "Hver 2. uge", startWeek: "", fixedEmployee: "Ingen", tasks: [] } : undefined}
        title="Opret abonnement"
        submitLabel="Opret abonnement"
        minuteRate={minuteRate}
      />
    </div>
  );
}
