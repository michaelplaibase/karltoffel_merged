export const metadata = { title: "Kontakt support · Karltoffel" };

export default function SupportPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Kontakt support</h1>
      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Vi er klar til at hjælpe</h4>
          <p className="muted" style={{ marginBottom: 16 }}>Har du spørgsmål til systemet, kan du kontakte os på nedenstående kanaler.</p>
          <div className="table-wrap">
            <table className="data-table"><tbody>
              <tr><td style={{ width: 200, color: "var(--muted)" }}>E-mail</td><td><a href="mailto:support@fenster.dk">support@fenster.dk</a></td></tr>
              <tr><td style={{ color: "var(--muted)" }}>Åbningstider</td><td>Man–fre kl. 9–16</td></tr>
              <tr><td style={{ color: "var(--muted)" }}>Svartid</td><td>Typisk inden for 1 arbejdsdag</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Hjælpecenter</h4>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li><a href="mailto:support@fenster.dk?subject=Kom%20godt%20i%20gang">Kom godt i gang-guide</a></li>
            <li><a href="mailto:support@fenster.dk?subject=Kalender%20og%20planlægning">Kalender og planlægning</a></li>
            <li><a href="mailto:support@fenster.dk?subject=Fakturering">Fakturering og Dinero</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
