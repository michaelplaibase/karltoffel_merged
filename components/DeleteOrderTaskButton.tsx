"use client";

// "Fjern"-knap pr. opgavelinje på ordresiden (Thomas, 2026-09-10): når kunden
// fx ikke ville have "indvendig", fjernes linjen, så den ikke bliver faktureret.
// Server-actionen sletter linjen i databasen; siden revaliderer sig selv.
import { useTransition } from "react";
import { deleteOrderTask } from "@/app/actions/orders";

export default function DeleteOrderTaskButton({ orderId, taskIndex }: { orderId: number; taskIndex: number }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      title="Fjern denne opgave fra ordren"
      style={{ padding: "4px 10px", fontSize: 12.5 }}
      onClick={() => {
        if (!window.confirm("Fjern opgaven fra ordren? Summen på ordren (og fakturaen) opdateres.")) return;
        start(async () => { await deleteOrderTask(orderId, taskIndex); });
      }}
    >
      {pending ? "…" : "Fjern"}
    </button>
  );
}
