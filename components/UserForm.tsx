"use client";

// Genbrugelig bruger-redigeringsformular (kun admin) — spejler ContactForm.
// Udfyldes via defaultValue fra UserRow; tom adgangskode = uændret.
import Link from "next/link";
import { useActionState, useState } from "react";
import type { UserState } from "@/app/actions/users";
import type { UserRow } from "@/lib/users";

export default function UserForm({
  action, initial, title, submitLabel, cancelHref,
}: {
  action: (state: UserState, formData: FormData) => Promise<UserState>;
  initial: UserRow;
  title: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [payModel, setPayModel] = useState<"fast" | "akkord">(initial.payModel);
  const [state, formAction, pending] = useActionState(action, {});
  const belobDefault = initial.payModel === "akkord"
    ? (initial.commissionPct != null ? String(initial.commissionPct) : "")
    : (initial.monthlySalary != null ? String(initial.monthlySalary) : "");

  return (
    <form action={formAction} className="card form-card">
      <div className="card-header header-primary">
        <h3>{title}</h3>
      </div>
      <div className="card-body">
        <div className="f2">
          <label>Fornavn</label>
          <input name="firstName" defaultValue={initial.firstName} className="form-control form-control-sm" autoComplete="off" />
        </div>
        <div className="f2">
          <label>Efternavn</label>
          <input name="lastName" defaultValue={initial.lastName} className="form-control form-control-sm" autoComplete="off" />
        </div>
        <div className="f2">
          <label>Brugernavn</label>
          <input name="username" defaultValue={initial.username} className="form-control form-control-sm" autoComplete="off" />
        </div>
        <div className="f2">
          <label>E-mail</label>
          <input name="email" type="email" defaultValue={initial.email ?? ""} className="form-control form-control-sm" autoComplete="off" />
        </div>
        <div className="f2">
          <label>Rolle</label>
          <select name="rolle" defaultValue={initial.rolle} className="form-control form-control-sm">
            <option value="medarbejder">Medarbejder</option>
            <option value="admin">Administrator (kan oprette brugere)</option>
          </select>
        </div>
        <div className="f2">
          <label>Kalenderfarve</label>
          <input name="calendarColor" type="color" defaultValue={initial.calendarColor ?? "#a4d5ee"} className="form-control form-control-sm" style={{ width: 64, padding: 2 }} />
        </div>
        <div className="f2">
          <label>Hjemmeadresse</label>
          <input name="homeAddress" defaultValue={initial.homeAddress ?? ""} className="form-control form-control-sm" placeholder="Vejnavn husnr., postnr. by" />
        </div>
        <div className="f2">
          <label>Aktiv kalender</label>
          <label className="form-check-inline" style={{ marginTop: 6 }}>
            <input type="checkbox" name="activeCalendar" defaultChecked={initial.activeCalendar} /> Vises som kolonne i kalenderen
          </label>
        </div>
        <div className="f2">
          <label>Kan modtage online-ordrer</label>
          <label className="form-check-inline" style={{ marginTop: 6 }}>
            <input type="checkbox" name="canReceiveOnline" defaultChecked={initial.canReceiveOnline} /> Ja
          </label>
        </div>
        <div className="f2">
          <label>Rettigheder</label>
          <div>
            <label className="form-check-inline" style={{ display: "block", marginTop: 6 }}>
              <input type="checkbox" name="canSeePrices" defaultChecked={initial.canSeePrices} /> Må se priser
            </label>
            <label className="form-check-inline" style={{ display: "block" }}>
              <input type="checkbox" name="canEditOrders" defaultChecked={initial.canEditOrders} /> Må redigere ordrer
            </label>
            <label className="form-check-inline" style={{ display: "block" }}>
              <input type="checkbox" name="canHandlePayment" defaultChecked={initial.canHandlePayment} /> Må håndtere betaling
            </label>
            <label className="form-check-inline" style={{ display: "block" }}>
              <input type="checkbox" name="canChangePaymentOption" defaultChecked={initial.canChangePaymentOption} /> Må ændre betalingsvalg
            </label>
            <small className="form-text field-help">Rettighederne gemmes, men håndhæves ikke i systemet endnu.</small>
          </div>
        </div>
        <div className="f2">
          <label>Lønmodel</label>
          <select name="payModel" value={payModel} className="form-control form-control-sm" onChange={(e) => setPayModel(e.target.value as "fast" | "akkord")}>
            <option value="fast">Fast løn</option>
            <option value="akkord">Akkord (provision)</option>
          </select>
        </div>
        <div className="f2">
          <label>{payModel === "akkord" ? "Provisionssats (%)" : "Fast løn (kr/md)"}</label>
          <input name="belob" type="number" min="0" defaultValue={belobDefault} className="form-control form-control-sm" placeholder={payModel === "akkord" ? "fx 43" : "fx 32000"} />
        </div>
        <div className="f2">
          <label>Ny adgangskode</label>
          <div>
            <input name="password" type="password" className="form-control form-control-sm" autoComplete="new-password" placeholder="Mindst 8 tegn" />
            <small className="form-text field-help">Lad stå tom for uændret adgangskode.</small>
          </div>
        </div>

        {state.error && (
          <div className="f2">
            <span />
            <div style={{ color: "#c0392b", fontSize: 13 }}>{state.error}</div>
          </div>
        )}

        <div className="savebar">
          <Link href={cancelHref} className="btn btn-light">Luk</Link>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Gemmer…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
