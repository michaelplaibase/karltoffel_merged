import { notFound } from "next/navigation";
import { getFixedPriceEditData, getEmployeeOptions } from "@/lib/queries";
import { scheduleFixedPrice } from "@/app/actions/fixed-prices";
import { routeId } from "@/lib/route-ids";
import { todayCphISO } from "@/lib/calendar";
import FixedPriceScheduleForm from "@/components/FixedPriceScheduleForm";

export const metadata = { title: "Planlæg fastprisaftale i kalender · Karltoffel Business Manager" };

// Planlæg ENKELTOPGAVE ud fra en fastprisaftale — når kunden ringer og
// bestiller opgaven via telefon eller mail. Samme flow som abonnementsopgaver
// (dato + medarbejder), men uden interval/gentagelse.
export default async function ScheduleFixedPrice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const displayNo = routeId(id); // ikke-numerisk id ⇒ 404, ikke Prisma-500
  const [fp, employees] = await Promise.all([getFixedPriceEditData(displayNo), getEmployeeOptions()]);
  if (!fp) notFound();

  return (
    <div className="container-1140">
      <h1 className="page-title">Planlæg fastprisaftale i kalender</h1>
      <FixedPriceScheduleForm
        action={scheduleFixedPrice.bind(null, fp.pk)}
        employees={employees}
        todayISO={todayCphISO()}
        agreementLabel={`Fastprisaftale #${fp.displayNo} — ${fp.tasks.length} opgave(r)`}
      />
    </div>
  );
}
