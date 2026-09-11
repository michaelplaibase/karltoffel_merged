import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@vercel/blob";
import { statusLabel, tilbudTotal, linjeKundeTekst } from "@/lib/tilbud.mts";
import { tilbudAarsbelobSum } from "@/lib/subscription-intervals";
import { tilbudMailBesked } from "@/lib/tilbud-send";
import { sendTilbud, markTilbudAccepted, convertTilbudToSubscription, deleteTilbud } from "@/app/actions/tilbud";
import TilbudSendPanel from "@/components/TilbudSendPanel";
import TilbudPhotoPanel from "@/components/TilbudPhotoPanel";

export const metadata = { title: "Tilbud · Karltoffel Business Manager" };
export const dynamic = "force-dynamic";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr.";

export default async function TilbudDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tilbudId = Number(id);
  if (!Number.isInteger(tilbudId) || tilbudId <= 0) notFound();

  const tilbud = await prisma.tilbud.findUnique({
    where: { id: tilbudId },
    include: {
      contact: { select: { id: true, name: true, companyName: true, email: true } },
      lines: { orderBy: { sort: "asc" } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!tilbud) notFound();

  const total = tilbudTotal(tilbud.lines); // til staff-mailen — vises IKKE som bundlinje
  // Thomas, 2026-09-11 (korrektion): Årsbeløbet er summen PR. LINJE — kun
  // linjer med interval tæller med (engangsopgaver tæller ikke).
  const aarligt = tilbudAarsbelobSum(tilbud.lines);
  const fotos = tilbud.photos.map((p) => ({ id: p.id, lineId: p.lineId, url: getDownloadUrl(p.url) }));
  const mailBesked = tilbudMailBesked({
    hilsenNavn: (tilbud.contact.name || "kunde").split(" ")[0],
    titel: tilbud.title,
    samlet: total,
  });
  const offentligtLink = `/t/${tilbud.acceptToken}`;

  return (
    <div className="container-1140" style={{ maxWidth: 1000 }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{tilbud.title}</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            <Link href={`/customers/${tilbud.contact.id}`}>{tilbud.contact.companyName || tilbud.contact.name}</Link>
            {" · Status: "}
            <b>{statusLabel(tilbud.status)}</b>
            {tilbud.sentAt ? ` · Sendt ${tilbud.sentAt.toLocaleDateString("da-DK")}` : ""}
          </p>
        </div>
        <Link href="/tilbud" className="btn btn-light">Til oversigten</Link>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="f2">
            <label className="col-label">Opgaver og priser</label>
            <div className="tasklines">
              {tilbud.lines.map((l) => (
                <div className="tl-row" key={l.id} style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>{linjeKundeTekst(l)}</span>
                  <span className="num">{kr(l.price)}</span>
                </div>
              ))}
              {/* Thomas, 2026-09-11: 'samlet beløb' fjernet — ÅRLIGT beløb når intervallet er sat. */}
              {aarligt != null ? (
                <div className="tl-sum"><span>Årligt beløb (inkl. moms)</span><b>{kr(aarligt)}</b></div>
              ) : null}
            </div>
          </div>
          {tilbud.note ? <p className="form-text" style={{ whiteSpace: "pre-line" }}>{tilbud.note}</p> : null}
          {tilbud.startWeek ? (
            <p className="page-desc">Start: {tilbud.startWeek}</p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="section-title" style={{ marginTop: 0 }}>Billeder</h2>
          <TilbudPhotoPanel
            tilbudId={tilbud.id}
            linjer={tilbud.lines.map((l) => ({ id: l.id, description: l.description }))}
            fotos={fotos}
          />
        </div>
      </div>

      {tilbud.status === "udkast" || tilbud.status === "sendt" ? (
        <div className="card">
          <div className="card-body">
            <h2 className="section-title" style={{ marginTop: 0 }}>Send til kunden</h2>
            <TilbudSendPanel
              tilbudId={tilbud.id}
              to={tilbud.contact.email ?? ""}
              besked={tilbudMailBesked({
                hilsenNavn: (tilbud.contact.name || "kunde").split(" ")[0],
                titel: tilbud.title,
                samlet: total,
              })}
              action={sendTilbud}
            />
            <hr className="section-hr" />
            <h2 className="section-title">Offentligt godkendelses-link</h2>
            <p className="page-desc">
              Kunden kan godkende tilbuddet via dette link (fx sendt i mailen eller en SMS):
            </p>
            <code style={{ display: "block", wordBreak: "break-all" }}>{offentligtLink}</code>
            <p className="form-text">På siden kan kunden klikke ”Godkend tilbud” — så skifter status automatisk til accepteret.</p>
          </div>
        </div>
      ) : null}

      {tilbud.status !== "konverteret" && tilbud.status !== "accepteret" ? (
        <form action={markTilbudAccepted.bind(null, tilbud.id)}>
          <button type="submit" className="btn btn-outline-primary">Kunde har accepteret (manuelt)</button>
        </form>
      ) : null}

      {tilbud.status === "accepteret" && !tilbud.convertedSubscriptionId ? (
        <form action={convertTilbudToSubscription.bind(null, tilbud.id)}>
          <button type="submit" className="btn btn-primary">Konvertér til abonnement</button>
          <p className="page-desc">Opretter et afventende abonnement med tilbuddets opgaver — interval og startuge følger med, hvis de er udfyldt på tilbuddet.</p>
        </form>
      ) : null}
      {tilbud.convertedSubscriptionId ? (
        <p><Link href={`/subscriptions/${tilbud.convertedSubscriptionId}`}>Se abonnementet</Link></p>
      ) : null}

      {tilbud.status === "udkast" ? (
        <form action={deleteTilbud.bind(null, tilbud.id)}>
          <button type="submit" className="btn btn-light">Slet udkast</button>
        </form>
      ) : null}
    </div>
  );
}