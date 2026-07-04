import Link from "next/link";

// Free-text search box (single `q` param) + numbered pagination — the two list
// controls every Kartotek page shares. SearchBar is a plain GET <form>, so the
// browser puts `q` in the URL and the server page re-queries; Pagination is a
// row of <Link>s that preserve the active query. Both keep the portal's markup.

export function SearchBar({ placeholder, q }: { placeholder: string; q?: string }) {
  return (
    <form className="searchbar" method="get">
      <input className="form-control" name="q" placeholder={placeholder} defaultValue={q ?? ""} />
      <button className="btn btn-light" type="submit">Søg</button>
    </form>
  );
}

/** Build "?q=…&page=N" preserving the current query (page 1 is left implicit). */
function href(path: string, q: string | undefined, page: number): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

export function Pagination({ path, page, totalPages, q }: { path: string; page: number; totalPages: number; q?: string }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const dim: React.CSSProperties = { opacity: 0.5, pointerEvents: "none" };
  return (
    <div className="row-actions" style={{ justifyContent: "flex-end", marginTop: 14 }}>
      {page <= 1
        ? <span className="btn btn-sm btn-light" style={dim}>forrige</span>
        : <Link className="btn btn-sm btn-light" href={href(path, q, page - 1)}>forrige</Link>}
      {pages.map((p) =>
        p === page
          ? <span key={p} className="btn btn-sm btn-primary">{p}</span>
          : <Link key={p} className="btn btn-sm btn-light" href={href(path, q, p)}>{p}</Link>
      )}
      {page >= totalPages
        ? <span className="btn btn-sm btn-light" style={dim}>næste</span>
        : <Link className="btn btn-sm btn-light" href={href(path, q, page + 1)}>næste</Link>}
    </div>
  );
}

/** Shared paging math: given all rows + the requested page, return the slice. */
export const PAGE_SIZE = 25;
export function paginate<T>(rows: T[], page: number): { slice: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), totalPages);
  return { slice: rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), page: p, totalPages };
}
