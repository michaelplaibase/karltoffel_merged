import Link from "next/link";

// 404-side — id-guards (lib/route-ids.ts) og catch-all-ruten sender hertil i
// stedet for at lade Prisma kaste en 500 på tastefejls-URL'er.
export default function NotFound() {
  return (
    <div className="container-1140" style={{ paddingTop: 48, maxWidth: 640 }}>
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">Siden findes ikke</h1>
          <p className="muted">Adressen er forkert, eller det du leder efter er slettet.</p>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <Link className="btn btn-primary" href="/calendar">Til kalenderen</Link>
            <Link className="btn btn-light" href="/customers">Til kunder</Link>
            <Link className="btn btn-light" href="/orders">Til ordrer</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
