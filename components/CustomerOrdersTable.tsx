"use client";

// Kundens ordrer på kundedetalje-siden, delt i to sektioner: "Kommende ordrer"
// (åbne statusser) og "Tidligere ordrer" (lukkede — spejler CLOSED_STATUSES i
// lib/queries.ts; afgøres alene af status, ikke dato). Begge tabeller kan
// sorteres ved klik på kolonneoverskrifterne; sorteringen sker i hukommelsen
// på de allerede indlæste rækker, så der intet server-kald kræves.
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Order } from "@/lib/data";
import { CatChip, StatusPill, money } from "@/components/ui";
import RowMenu, { type RowMenuItem } from "@/components/RowMenu";
import { deleteOrder } from "@/app/actions/orders";

/** Spejler CLOSED_STATUSES i lib/queries.ts. */
const CLOSED_STATUSES = new Set(["Afsluttet", "Udført", "Sprunget over"]);

type SortKey = "id" | "deliveryDate" | "tasks" | "price" | "employee" | "status" | "source";
type Sort = { key: SortKey; dir: 1 | -1 };

const priceOf = (o: Order) => o.tasks.reduce((a, t) => a + t.price, 0);

const COMPARATORS: Record<SortKey, (a: Order, b: Order) => number> = {
  id: (a, b) => a.id - b.id,
  deliveryDate: (a, b) => a.deliveryDate.localeCompare(b.deliveryDate), // ISO-datoer sorterer kronologisk
  tasks: (a, b) => (a.tasks[0]?.description ?? "").localeCompare(b.tasks[0]?.description ?? "", "da"),
  price: (a, b) => priceOf(a) - priceOf(b),
  employee: (a, b) => a.employee.localeCompare(b.employee, "da"),
  status: (a, b) => a.status.localeCompare(b.status, "da"),
  source: (a, b) => a.source.localeCompare(b.source, "da", { numeric: true }),
};

function sortOrders(rows: Order[], sort: Sort): Order[] {
  const cmp = COMPARATORS[sort.key];
  return [...rows].sort((a, b) => sort.dir * cmp(a, b) || a.id - b.id); // stabil tie-break på ordrenr.
}

function SortTh({ label, k, sort, onSort }: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void }) {
  const active = sort.key === k;
  return (
    <th>
      <button type="button" className="th-sort" onClick={() => onSort(k)}>
        {label}
        {active ? <i className={`bi ${sort.dir === 1 ? "bi-caret-up-fill" : "bi-caret-down-fill"}`} /> : null}
      </button>
    </th>
  );
}

function OrdersTable({ rows, sort, onSort, emptyText }: { rows: Order[]; sort: Sort; onSort: (k: SortKey) => void; emptyText: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>
          <th style={{ width: 34 }} />
          <SortTh label="Ordre nr." k="id" sort={sort} onSort={onSort} />
          <SortTh label="Leverings-dato" k="deliveryDate" sort={sort} onSort={onSort} />
          <SortTh label="Opgaver" k="tasks" sort={sort} onSort={onSort} />
          <SortTh label="Pris" k="price" sort={sort} onSort={onSort} />
          <SortTh label="Medarbejder" k="employee" sort={sort} onSort={onSort} />
          <SortTh label="Ordrestatus" k="status" sort={sort} onSort={onSort} />
          <SortTh label="Kilde" k="source" sort={sort} onSort={onSort} />
        </tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8}><div className="table-empty">{emptyText}</div></td></tr>
          ) : rows.map((o) => {
            const items: RowMenuItem[] = [
              { label: "Vis ordre i kalender", href: `/calendar?week=${o.weekMonday}` },
              { label: "Rediger ordre", href: `/orders/${o.id}` },
              { label: "Afslut ordre…", href: `/orders/${o.id}/complete` },
              { label: "Send tilbud på ordren…", href: `/orders/${o.id}/send-tilbud` },
              { label: "Opret ny ordre", href: `/orders/new?for_contact=${o.contactId}` },
              ...(o.subscriptionNo ? [{ label: "Rediger abonnement", href: `/subscriptions/${o.subscriptionNo}` }] : []),
              { label: "Slet ordre…", danger: true, action: () => deleteOrder(o.id),
                confirm: { title: "Slet ordre", body: `Er du sikker på, at du vil slette ordre #${o.id}?`, confirmLabel: "Slet ordre", note: "Denne handling kan ikke fortrydes." } },
            ];
            return (
            <tr key={o.id}>
              <td><RowMenu items={items} /></td>
              <td className="num"><Link href={`/orders/${o.id}`}>{o.id}</Link></td>
              <td className="num">{o.overdue ? <span className="badge badge-soft-warning">{o.deliveryDate}</span> : o.deliveryDate}</td>
              <td>{o.tasks.map((t, i) => <div key={i}><CatChip category={t.category} letter={t.letter} /> {t.description}</div>)}</td>
              <td className="num">{money(o.tasks.reduce((a, t) => a + t.price, 0))}</td>
              <td>{o.employee}</td>
              <td><StatusPill status={o.status} /></td>
              <td>{o.subscriptionNo ? <Link href={`/subscriptions/${o.subscriptionNo}`}>{o.source}</Link> : o.source}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerOrdersTable({ orders, contactId }: { orders: Order[]; contactId: number }) {
  const [kommendeSort, setKommendeSort] = useState<Sort>({ key: "deliveryDate", dir: 1 });
  const [tidligereSort, setTidligereSort] = useState<Sort>({ key: "deliveryDate", dir: -1 });
  const [showTidligere, setShowTidligere] = useState(false);

  const kommende = useMemo(() => sortOrders(orders.filter((o) => !CLOSED_STATUSES.has(o.status)), kommendeSort), [orders, kommendeSort]);
  const tidligere = useMemo(() => sortOrders(orders.filter((o) => CLOSED_STATUSES.has(o.status)), tidligereSort), [orders, tidligereSort]);

  const toggleSort = (set: React.Dispatch<React.SetStateAction<Sort>>) => (key: SortKey) =>
    set((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <>
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 className="section-title">Kommende ordrer</h4>
          <Link href={`/orders/new?for_contact=${contactId}`} className="btn btn-primary btn-sm">Opret ny ordre på kunden</Link>
        </div>
        <div className="card-body tight">
          <OrdersTable rows={kommende} sort={kommendeSort} onSort={toggleSort(setKommendeSort)} emptyText="Ingen kommende ordrer" />
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 className="section-title">Tidligere ordrer</h4>
          <button type="button" className="btn btn-light btn-sm" onClick={() => setShowTidligere((v) => !v)}>
            {showTidligere ? "Skjul tidligere ordrer" : "Vis tidligere ordrer"}
          </button>
        </div>
        {showTidligere && (
          <div className="card-body tight">
            <OrdersTable rows={tidligere} sort={tidligereSort} onSort={toggleSort(setTidligereSort)} emptyText="Ingen tidligere ordrer" />
          </div>
        )}
      </div>
    </>
  );
}
