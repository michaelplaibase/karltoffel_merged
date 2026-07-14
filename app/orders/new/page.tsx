import Link from "next/link";
import { getContactOptions, getMinuteRate } from "@/lib/queries";
import { createOrder } from "@/app/actions/orders";
import { isoWeek } from "@/lib/planner";
import { weekMondayToday } from "@/lib/calendar";
import OrderCreateForm, { type WeekOption } from "@/components/OrderCreateForm";

export const metadata = { title: "Opret ny ordre · Karltoffel" };

/** Next `count` week options starting at `fromMondayISO`, value = Monday ISO. */
function weekOptions(fromMondayISO: string, count: number): WeekOption[] {
  const start = new Date(`${fromMondayISO}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const mon = new Date(start.getTime() + i * 7 * 864e5);
    const sun = new Date(mon.getTime() + 6 * 864e5);
    const iso = `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, "0")}-${String(mon.getUTCDate()).padStart(2, "0")}`;
    const md = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
    return { value: iso, label: `Uge ${isoWeek(iso)}, ${mon.getUTCFullYear()} (${md(mon)} - ${md(sun)})` };
  });
}

export default async function NewOrder({ searchParams }: { searchParams: Promise<{ for_contact?: string }> }) {
  const { for_contact } = await searchParams;
  const [contacts, minuteRate] = await Promise.all([getContactOptions(), getMinuteRate()]);
  const initialContactId = for_contact ? Number(for_contact) : undefined;

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title">Opret ny ordre</h1>
        <Link href="/orders" className="btn btn-light">Gå tilbage</Link>
      </div>

      <OrderCreateForm
        action={createOrder}
        contacts={contacts}
        weekOptions={weekOptions(weekMondayToday(), 12)}
        initialContactId={initialContactId}
        minuteRate={minuteRate}
      />
    </div>
  );
}
