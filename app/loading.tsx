// Route-transition fallback. Every page is an async server component hitting
// Neon, so without this each navigation freezes on the previous page until the
// query round-trip returns. Rendered inside Shell, so the navbar stays put.
export default function Loading() {
  return (
    <div className="container-1140" aria-busy="true" aria-label="Indlæser">
      <div className="skeleton sk-title" />
      <div className="card">
        <div className="card-body">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton sk-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
