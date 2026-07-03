import type { SPage } from "@/lib/settings-config";
import { Field } from "@/components/Field";

export default function SettingsForm({ page }: { page: SPage }) {
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      {page.purpose ? <p className="page-desc" style={{ marginTop: 4 }}>{page.purpose}</p> : null}
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">{page.title}</h1>
          {page.sections.map((s, si) => (
            <section key={si}>
              {si > 0 ? <hr className="section-hr" /> : null}
              {s.h ? <h4 className="section-title">{s.h}</h4> : null}
              {s.fields.map((f, fi) => <Field key={fi} f={f} />)}
            </section>
          ))}
          {!page.noSave ? (
            <>
              <hr className="section-hr" />
              <button className="btn btn-primary" type="button">{page.saveLabel ?? "Gem alle ændringer"}</button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
