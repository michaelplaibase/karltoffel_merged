import Link from "next/link";
import { prisma } from "@/lib/db";
import { statusLabel } from "@/lib/tilbud.mts";

export const metadata = { title: "Tilbud · Karltoffel Business Manager" };
export const dynamic = "force-dynamic";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr.";

export default async function TilbudPage() {
  let tilbud: Awaited<ReturnType<typeof prisma.tilbud.findMany>> = [];
  let dbFejl = false;
  try {
    tilbud = await prisma.tilbud.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      contact: { select: { id: true, name: true, companyName: true } },
      lines: { select: { price: true } },
    },
    take: 200,
  });
  } catch {
    dbFejl = true;
  }

  return (
    <div className="container-1140">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Tilbud</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>Lav tilbud til kunderne — send dem med billeder og priser, og konvertér accepterede tilbud til abonnementer.</p>
        </div>
        <Link href="/tilbud/new" className="btn btn-primary">Nyt tilbud</Link>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Titel</th><th>Kunde</th><th>Linjer</th><th>Total</th><th>Status</th><th>Oprettet</th></tr>
              </thead>
              <tbody>
                {dbFejl ? (
                  <tr><td colSpan={6} style={{ color: "#8A6931" }}>Tilbud-tabel mangler i preview-databasen — oprettes automatisk, når modulet sættes live.</td></tr>
                ) : tilbud.length === 0 ? (
                  <tr><td colSpan={6}>Ingen tilbud endnu — opret det første.</td></tr>
                ) : (
                  tilbud.map((t) => {
                    const total = t.lines.reduce((a, l) => a + l.price, 0);
                    return (
                      <tr key={t.id}>
                        <td><Link href={`/tilbud/${t.id}`} className="strong-link">{t.title}</Link></td>
                        <td><Link href={`/customers/${t.contact.id}`}>{t.contact.companyName || t.contact.name}</Link></td>
                        <td>{t.lines.length}</td>
                        <td className="num">{kr(total)}</td>
                        <td>{statusLabel(t.status)}</td>
                        <td>{t.createdAt.toLocaleDateString("da-DK")}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}