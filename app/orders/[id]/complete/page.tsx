import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/queries";
import { completeOrder } from "@/app/actions/orders";
import { MapLink } from "@/components/ui";
import CompleteOrderForm from "@/components/CompleteOrderForm";

export const metadata = { title: "Afslut ordre · Karltoffel" };

export default async function CompleteOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  const o = await getOrderDetail(orderId);
  if (!o) notFound();
  const c = o.contact;

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title">Afslut ordre</h1>
        <Link href="/orders" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h4 className="section-title">Kundeinfo</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              <b>{c.name}</b>{"\n"}
              {c.street}, {c.city}{"\n"}
              {c.att && c.att !== "—" ? `Att: ${c.att}\n` : ""}
              {c.phone} · {c.email}
            </div>
            <div style={{ marginTop: 10 }}><MapLink address={`${c.street}, ${c.city}`} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4 className="section-title">Pris</h4></div>
          <div className="card-body tight">
            <div className="form-static">
              Pris uden kørsel kr. {o.sumPrice.toLocaleString("da-DK")}{"\n"}
              Kørselsgebyr kr. 0{"\n"}
              <span className="muted">(Alle beløb er inkl. moms)</span>
            </div>
          </div>
        </div>
      </div>

      <CompleteOrderForm
        action={completeOrder.bind(null, orderId)}
        initialComment={o.comment}
        initialAddressNote={o.addressNote}
        backUrl="/orders"
      />
    </div>
  );
}
