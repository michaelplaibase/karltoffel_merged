import { notFound } from "next/navigation";
import { getFixedPriceEditData, getContactOptions, getMinuteRate } from "@/lib/queries";
import { updateFixedPrice, deleteFixedPrice } from "@/app/actions/fixed-prices";
import FixedPriceForm from "@/components/FixedPriceForm";
import ConfirmButton from "@/components/ConfirmButton";

export const metadata = { title: "Rediger fastprisaftale · Karltoffel" };

export default async function EditFixedPrice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const displayNo = Number(id);
  const [fp, contacts, minuteRate] = await Promise.all([
    getFixedPriceEditData(displayNo),
    getContactOptions(),
    getMinuteRate(),
  ]);
  if (!fp) notFound();

  return (
    <div className="container-1140">
      <FixedPriceForm
        action={updateFixedPrice.bind(null, fp.pk)}
        contacts={contacts}
        initial={{ contactId: fp.contactId, tasks: fp.tasks }}
        title={`Rediger fastprisaftale #${fp.displayNo}`}
        submitLabel="Opdater fastprisaftale"
        minuteRate={minuteRate}
        danger={
          <ConfirmButton
            action={deleteFixedPrice.bind(null, fp.pk)}
            label="Slet fastprisaftale" title="Bekræftelse"
            body="Er du sikker på, at du vil slette fastprisaftalen?"
            confirmLabel="Slet fastprisaftale"
            irreversibleNote="Denne handling kan ikke fortrydes."
          />
        }
      />
    </div>
  );
}
