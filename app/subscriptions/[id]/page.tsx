import { notFound } from "next/navigation";
import { getSubscriptionEditData, getContactOptions, getEmployeeNames, getMinuteRate } from "@/lib/queries";
import { updateSubscription, stopSubscription, approveSubscription } from "@/app/actions/subscriptions";
import SubscriptionForm from "@/components/SubscriptionForm";
import ConfirmButton from "@/components/ConfirmButton";

export const metadata = { title: "Rediger abonnement · Karltoffel" };

export default async function EditSubscription({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const displayNo = Number(id);
  const [sub, contacts, employees, minuteRate] = await Promise.all([
    getSubscriptionEditData(displayNo),
    getContactOptions(),
    getEmployeeNames(),
    getMinuteRate(),
  ]);
  if (!sub) notFound();

  return (
    <div className="container-1140">
      {sub.pending && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid #ffb400" }}>
          <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <b>Afventer godkendelse</b>
              {(sub.packageName || sub.quotedMonthly) && (
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  {sub.packageName ? <>Valgt pakke: <b>{sub.packageName}</b></> : null}
                  {sub.quotedMonthly ? <>{sub.packageName ? " · " : ""}Tilbudt pris: <b>{sub.quotedMonthly.toLocaleString("da-DK")} kr/md</b></> : null}
                </div>
              )}
              <div className="muted" style={{ fontSize: 13 }}>
                Oprettet fra tilbudsmotor-lead. Ring til kunden, bekræft prisen — og godkend for at aktivere abonnementet og lægge ordrerne i kalenderen.
              </div>
            </div>
            <ConfirmButton
              action={approveSubscription.bind(null, sub.pk)}
              label="Godkend abonnement" title="Godkend abonnement"
              body={`Godkend abonnement #${sub.displayNo}? Abonnementet aktiveres, og de kommende ordrer lægges i kalenderen.`}
              confirmLabel="Godkend"
            />
          </div>
        </div>
      )}
      <SubscriptionForm
        action={updateSubscription.bind(null, sub.pk)}
        contacts={contacts}
        employees={employees}
        initial={{
          contactId: sub.contactId, baseInterval: sub.baseInterval, startWeek: sub.startWeek,
          fixedEmployee: sub.fixedEmployee, tasks: sub.tasks, attachments: sub.attachments,
        }}
        title={`Rediger abonnement #${sub.displayNo}`}
        submitLabel="Opdater abonnement"
        minuteRate={minuteRate}
        danger={
          <ConfirmButton
            action={stopSubscription.bind(null, sub.pk)}
            label="Stop abonnement" title="Stop abonnement"
            body="Er du sikker på, at du vil stoppe abonnementet? Der oprettes ikke flere ordrer, og kommende uleverede (ulåste) ordrer fjernes fra kalenderen."
            confirmLabel="Stop abonnement"
          />
        }
      />
    </div>
  );
}
