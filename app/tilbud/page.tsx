import Link from "next/link";
import { prisma } from "@/lib/db";
import { statusLabel } from "@/lib/tilbud.mts";
// Thomas, 2026-09-12 (fejlretning): oversigten viser nu ÅRSLIGT beløb
// (kun linjer med interval) i stedet for det samlede beløb.
import { tilbudAarsbelobSum } from "@/lib/subscription-intervals";
import { tilbudMomsOgIalt, krMoms } from "@/lib/vat";
// Thomas, 2026-09-14: søgefelt — mange tilbud skal kunne findes frem.
import { SearchBar } from "@/components/ListControls";

export const metadata = { title: "Tilbud · Karltoffel Business Manager" };
export const dynamic = "force-dynamic";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr.";

async function loadTilbud(q?: string) {
  const term = q?.trim();
  return prisma.tilbud.findMany({
    where: term
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { contact: { name: { contains: term, mode: "insensitive" } } },
            { contact: { companyName: { contains: term, mode: "insensitive" } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      contact: { select: { id: true, name: true, companyName: true } },
      lines: { select: { price: true, interval: true, startWeek: true, pauseActive: true, pauseStart: true, pauseEnd: true, pauseYearly: true } },
    },
    take: 200,
  });
}

export default async function TilbudPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;

  let tilbud: Awaited<ReturnType<typeof loadTilbud>> = [];
  let dbFejl = false;
  try {
    tilbud = await loadTilbud(q);
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
        <div className="toolbar">
          <SearchBar placeholder="Søg i titel eller kunde…" q={q} />
          <Link href="/tilbud/new" className="btn btn-primary">Nyt tilbud</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Titel</th><th>Kunde</th><th>Linjer</th><th>Årsbeløb</th><th>Status</th><th>Oprettet</th></tr>
              </thead>
              <tbody>
                {dbFejl ? (
                  <tr><td colSpan={6} style={{ color: "#8A6931" }}>Tilbud-tabel mangler i preview-databasen — oprettes automatisk, når modulet sættes live.</td></tr>
                ) : q && tilbud.length === 0 ? (
                  <tr><td colSpan={6}>Ingen tilbud matcher din søgning.</td></tr>
                ) : tilbud.length === 0 ? (
                  <tr><td colSpan={6}>Ingen tilbud endnu — opret det første.</td></tr>
                ) : (
                  tilbud.map((t) => {
                    const aarligt = tilbudAarsbelobSum(t.lines);
                    // Thomas, 2026-09-15: årsbeløb vises U. moms — ialt inkl.
                    // moms som sekundært tal (samme lib/vat-funktion som
                    // formular, detaljeside, PDF og accept-side).
                    const momsBund = aarligt != null ? tilbudMomsOgIalt(aarligt) : null;
                    return (
                      <tr key={t.id}>
                        <td>
                          <Link href={`/tilbud/${t.id}`} className="strong-link">{t.title}</Link>
                          {/* Thomas, 2026-09-17: holdet kan redigere både udkast
                              og SENDTE tilbud direkte fra oversigten. */}
                          {t.status === "udkast" || t.status === "sendt" ? (
                            <small className="form-text" style={{ display: "block" }}>
                              <Link href={`/tilbud/${t.id}/edit`}>Rediger</Link>
                            </small>
                          ) : null}
                        </td>
                        <td><Link href={`/customers/${t.contact.id}`}>{t.contact.companyName || t.contact.name}</Link></td>
                        <td>{t.lines.length}</td>
                        <td className="num">
                          {momsBund ? (
                            <>
                              {kr(momsBund.ekskl)}
                              <small className="form-text" style={{ display: "block" }}>Ialt inkl. moms: {krMoms(momsBund.ialt)}</small>
                            </>
                          ) : "–"}
                        </td>
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
