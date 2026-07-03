import { Field } from "@/components/Field";
import { PRICE_ADJUSTMENT as P } from "@/lib/funktioner";

export const metadata = { title: "Prisjustering · Karltoffel" };

export default function PriceAdjustmentPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">{P.title}</h1>
      <div className="card">
        <div className="card-body">
          <div className="steps">
            {P.steps.map((s, i) => (
              <span key={i} className={`step${i === 0 ? " on" : ""}`}><span className="n">{i + 1}</span>{s}</span>
            ))}
          </div>
          {P.sections.map((sec, si) => (
            <section key={si}>
              {si > 0 ? <hr className="section-hr" /> : null}
              {sec.h ? <h4 className="section-title">{sec.h}</h4> : null}
              {sec.fields.map((f, fi) => <Field key={fi} f={f} />)}
            </section>
          ))}
          <hr className="section-hr" />
          <button className="btn btn-primary">{P.submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
