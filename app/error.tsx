"use client";

import Link from "next/link";

// Global error boundary — uden den ender enhver uventet fejl som en rå
// Next.js-500 uden navigation eller forklaring.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Log altid til serveren (Vercel runtime logs) — ellers kan vi ikke se årsagen
  // bag "Der gik noget galt". Klient-komponent, så det måske duplikerer — fint.
  if (typeof console !== "undefined") console.error("[error-boundary]", error?.digest, error);
  return (
    <div className="container-1140" style={{ paddingTop: 48, maxWidth: 640 }}>
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">Der gik noget galt</h1>
          <p className="muted">
            Siden kunne ikke vises. Prøv igen — og hvis fejlen bliver ved, så brug
            frustrationsknappen eller kontakt support med tidspunktet og hvad du var i gang med.
          </p>
          {error.digest && <p className="muted" style={{ fontSize: 12 }}>Fejl-id: {error.digest}</p>}
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" type="button" onClick={() => reset()}>Prøv igen</button>
            <Link className="btn btn-light" href="/calendar">Til kalenderen</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
