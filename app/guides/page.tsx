import { GUIDES } from "@/lib/guides";
import { GuideBody } from "@/components/GuideContent";

export const metadata = { title: "Vejledninger · Karltoffel" };

// In-app help: all how-to guides on one page, with a jump-to table of contents.
export default function GuidesPage() {
  return (
    <div className="container-1140" id="top">
      <h1 className="page-title">Vejledninger</h1>
      <p className="page-desc">Trin-for-trin guides til de vigtigste arbejdsgange i Karltoffel. Klik på et emne for at hoppe direkte til det.</p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h4 className="section-title" style={{ marginBottom: 12 }}>Indhold</h4>
          <ol className="guide-toc">
            {GUIDES.map((g) => (
              <li key={g.slug}><a href={`#${g.slug}`}>{g.title}</a></li>
            ))}
          </ol>
        </div>
      </div>

      {GUIDES.map((g) => (
        <section id={g.slug} key={g.slug} className="card guide-section">
          <div className="card-header header-primary"><h3 style={{ margin: 0 }}>{g.title}</h3></div>
          <div className="card-body">
            <p className="guide-intro">{g.intro}</p>

            {g.steps.map((s, i) => (
              <div className="guide-step" key={i}>
                <h4 className="guide-step-title"><span className="guide-step-n">{i + 1}</span>{s.title}</h4>
                <GuideBody text={s.body} />
              </div>
            ))}

            {g.tips.length ? (
              <div className="guide-tips">
                <h4 className="guide-tips-title">Gode råd</h4>
                <ul className="guide-list" style={{ marginBottom: 0 }}>
                  {g.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ) : null}

            <p style={{ marginTop: 18, marginBottom: 0 }}>
              <a href="#top" className="muted" style={{ fontSize: 13 }}>↑ Til toppen</a>
            </p>
          </div>
        </section>
      ))}
    </div>
  );
}
