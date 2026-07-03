import { notFound } from "next/navigation";
import { getSubscriptionEditData, getContactOptions, getEmployeeNames } from "@/lib/queries";
import { updateSubscription } from "@/app/actions/subscriptions";
import SubscriptionForm from "@/components/SubscriptionForm";

export const metadata = { title: "Rediger abonnement · Karltoffel" };

export default async function EditSubscription({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const displayNo = Number(id);
  const [sub, contacts, employees] = await Promise.all([
    getSubscriptionEditData(displayNo),
    getContactOptions(),
    getEmployeeNames(),
  ]);
  if (!sub) notFound();

  return (
    <div className="container-1140">
      <SubscriptionForm
        action={updateSubscription.bind(null, sub.pk)}
        contacts={contacts}
        employees={employees}
        initial={{
          contactId: sub.contactId, baseInterval: sub.baseInterval, startWeek: sub.startWeek,
          fixedEmployee: sub.fixedEmployee, tasks: sub.tasks,
        }}
        title={`Rediger abonnement #${sub.displayNo}`}
        submitLabel="Opdater abonnement"
      />
    </div>
  );
}
