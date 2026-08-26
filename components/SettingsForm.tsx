"use client";

import { useActionState } from "react";
import type { SPage, SField } from "@/lib/settings-config";
import type { SaveState } from "@/app/actions/settings";
import { Field } from "@/components/Field";

const SAVABLE = new Set(["text", "number", "date", "textarea", "select", "checks", "radio", "toggle", "color"]);
const savable = (f: SField) => !f.ro && SAVABLE.has(f.t);

export default function SettingsForm({
  page, values, action,
}: {
  page: SPage;
  values: Record<string, string[]>;
  action: (state: SaveState, formData: FormData) => Promise<SaveState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const editable = !page.noSave;

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      {page.purpose ? <p className="page-desc" style={{ marginTop: 4 }}>{page.purpose}</p> : null}
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">{page.title}</h1>
          <form action={formAction}>
            {page.sections.map((s, si) => (
              <section key={si}>
                {si > 0 ? <hr className="section-hr" /> : null}
                {s.h ? <h4 className="section-title">{s.h}</h4> : null}
                {s.fields.map((f, fi) => {
                  // f.key vinder over positionen: indsatte noter/dynamiske
                  // sektioner må ikke forskyde allerede gemte værdier.
                  const key = f.key ?? `s${si}f${fi}`;
                  const name = editable && savable(f) ? key : undefined;
                  return <Field key={fi} f={f} name={name} value={name ? values[key] : undefined} />;
                })}
              </section>
            ))}
            {editable ? (
              <>
                <hr className="section-hr" />
                <div className="row-actions" style={{ alignItems: "center", gap: 12 }}>
                  <button className="btn btn-primary" type="submit" disabled={pending}>
                    {pending ? "Gemmer…" : (page.saveLabel ?? "Gem alle ændringer")}
                  </button>
                  {state.saved ? <span style={{ color: "var(--success)", fontSize: 13 }}>✓ Gemt</span> : null}
                </div>
              </>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
