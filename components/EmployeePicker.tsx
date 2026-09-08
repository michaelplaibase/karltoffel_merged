"use client";

// Medarbejder-skift på ordresiden (/orders/[id]): dropdown, der direkte
// ændrer ordrens tildelte medarbejder via changeOrderEmployee.
// Tom valg = "Ikke tildelt" (null). Siden revalidater sig selv efter gem.
import { useState, useTransition } from "react";

export default function EmployeePicker({
  orderId, currentId, employees,
}: {
  orderId: number;
  currentId: number | null;
  employees: { id: number; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <select
        className="form-control form-control-sm"
        defaultValue={currentId != null ? String(currentId) : ""}
        style={{ maxWidth: 220 }}
        onChange={(e) => {
          const v = e.target.value;
          const empId = v === "" ? null : Number(v);
          if (empId === currentId) return;
          setSaved(false);
          startTransition(async () => {
            const { changeOrderEmployee } = await import("@/app/actions/orders");
            await changeOrderEmployee(orderId, empId);
            setSaved(true);
          });
        }}
      >
        <option value="">Ikke tildelt</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
      {pending && <span className="muted" style={{ fontSize: 12 }}>Gemmer…</span>}
      {!pending && saved && <span className="badge badge-soft-success" style={{ fontSize: 12 }}>Skiftet</span>}
    </div>
  );
}
