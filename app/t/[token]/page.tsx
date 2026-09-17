import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { underLimit, recordHit } from "@/lib/rate-limit";
import { tilbudTotal, linjeKundeTekst, linjeStartugeTekst, bygAarshjul, linjeFarve } from "@/lib/tilbud.mts";
import Aarshjul from "@/components/Aarshjul";
import { tilbudAarsbelobSum } from "@/lib/subscription-intervals";
import { tilbudMomsOgIalt, krMoms } from "@/lib/vat";

// Offentlig accept-side (Thomas, 2026-09-11): kunden klikker "Godkend tilbud" på
// /t/{token}. Ingen login — tokenet ER autorisationen, samme mønster som
// QuoteToken: atomic forbrug via updateMany (status='sendt' i where), så
// dobbelt-klik/prefetch kun kan acceptere én gang. Server action muterer og
// revalidatePath/redirect gøres via status-tjek efterfølgende.

export const metadata = { title: "Godkend tilbud · Karltoffel" };

const kr = (n: number) => n.toLocaleString("da-DK") + " kr.";

/** Thomas, 2026-09-17: pristekst pr. linje på accept-siden. PRIVATE kunder:
 *  "566 kr. pr. gang (u. moms)" + ny linje "707,50 kr. pr. gang (inkl. moms)"
 *  — samme regel som PDF'en. Virksomheder: kun u. moms (som hidtil). */
function linjeAcceptPrisTekst(price: number, privatKunde: boolean) {
  if (!privatKunde) {
    return <>{kr(price)} <small style={{ fontWeight: 400 }}>(u. moms)</small></>;
  }
  const m = tilbudMomsOgIalt(price);
  return (
    <>
      {kr(price)} <small style={{ fontWeight: 400 }}>(u. moms)</small>
      <br />
      {krMoms(m.ialt)} <small style={{ fontWeight: 400 }}>(inkl. moms)</small>
    </>
  );
}

export default async function TilbudAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  // Groft pr.-IP-værn på det offentlige link (fin lås er updateMany ovenfor).
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!underLimit(`tilbud:${ip}`, 300)) notFound();
  recordHit(`tilbud:${ip}`, 60_000);

  let tilbud: Awaited<ReturnType<typeof loadTilbud>> = null;
  async function loadTilbud() {
    return prisma.tilbud.findUnique({
    where: { acceptToken: token },
    include: {
      contact: { select: { name: true, companyName: true, street: true, city: true, isCompany: true } },
      lines: { orderBy: { sort: "asc" }, select: { description: true, price: true, interval: true, startWeek: true } },
    },
  });
  }
  try {
    tilbud = await loadTilbud();
  } catch {
    // Databasen mangler fx Tilbud-tabelerne (preview-database før merge) — vis venlig fejl, ikke crash.
    return (
      <div className="container-640">
        <div className="card"><div className="card-body">
          <h1 className="page-title">Tilbuddet er ikke klar endnu</h1>
          <p>Vi kigger på det — prøv igen om lidt, eller kontakt os på hej@karltoffel.dk.</p>
        </div></div>
      </div>
    );
  }
  if (!tilbud) notFound();

  const total = tilbudTotal(tilbud.lines); // pris pr. gang — input til staff-mailen
  // Thomas, 2026-09-11 (korrektion): Årsbeløbet = summen PR. LINJE — kun
  // linjer med interval tæller med; linjer uden interval er engangsopgaver.
  const aarligt = tilbudAarsbelobSum(tilbud.lines);
  // Thomas, 2026-09-15: priser u. moms — moms (25%) i bunden (samme
  // lib/vat-funktion som formular, detaljeside, oversigt og PDF).
  const momsBund = aarligt != null ? tilbudMomsOgIalt(aarligt) : null;
  // Thomas, 2026-09-17: PRIVATE kunder ser prisen INKL. moms pr. linje
  // (samme regel som PDF'en); virksomheder kun u. moms (som hidtil).
  const privatKunde = tilbud.contact.isCompany !== true;
  let accepted = tilbud.status === "accepteret" || tilbud.status === "konverteret";

  // Primitiver til server actionen (den kan ikke close over en evt. null tilbud)
  const tId = tilbud.id;
  const kundeNavn = tilbud.contact.companyName || tilbud.contact.name;
  const titel = tilbud.title;

  async function godkendAction(): Promise<void> {
    "use server";
    if (!underLimit(`tilbud-godkend:${ip}`, 30)) return;
    recordHit(`tilbud-godkend:${ip}`, 60_000);
    // Atomic: kun den første godkend vinder — kundens klik kan ikke dobbelt-registreres.
    const claimed = await prisma.tilbud.updateMany({
      where: { acceptToken: token, status: "sendt" },
      data: { status: "accepteret", acceptedAt: new Date(), acceptMethod: "link" },
    });
    if (claimed.count === 0) return;
    accepted = true;
    // Notificér holdet (best effort — må aldrig til besvær for kundens klik)
    try {
      const staff = process.env.STAFF_NOTIFY_EMAIL?.trim() || "kristian@karltoffel.dk";
      await sendEmail({
        to: staff,
        subject: `✅ ${kundeNavn} godkendte tilbuddet`,
        text:
          `${kundeNavn} har klikket "Godkend tilbud" på det offentlige link.\n\n` +
          `Tilbud: ${titel}${aarligt != null ? ` (årligt ${aarligt.toLocaleString("da-DK")} kr.)` : ""}\n` +
          `Åbn i CRM: https://crm.karltoffel.dk/tilbud/${tId}`,
      });
    } catch (e) {
      console.error("[tilbud] staff-notifikation fejlede:", e);
    }
  }

  const kanGodkende = tilbud.status === "sendt" && !accepted && sp.g !== "1";

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFF0", color: "#4C3718", fontFamily: "sans-serif", padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ background: "#4C3718", borderRadius: 8, padding: "14px 20px", color: "#FFF87B", fontWeight: 700, fontSize: 22, letterSpacing: 1 }}>
        KARLTOFFEL
      </div>
      <div style={{ background: "#FFF87B", borderRadius: 8, padding: 20, marginTop: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{tilbud.title}</h1>
        <p style={{ margin: "6px 0 0" }}>Til {tilbud.contact.companyName || tilbud.contact.name}</p>
        {/* Thomas, 2026-09-15: kundens adresse diskret under kundenavnet. */}
        {(tilbud.contact.street || tilbud.contact.city) ? (
          <small style={{ color: "#8A6931", display: "block" }}>{[tilbud.contact.street, tilbud.contact.city].filter(Boolean).join(", ")}</small>
        ) : null}
      </div>

      <div style={{ marginTop: 18 }}>
        {tilbud.lines.map((l, i) => (
          <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid #e8e0c8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              {/* Thomas, 2026-09-15: farve-prik pr. linje — samme farve som
                  linjens chips i årshjulet (linjeFarve(i)). */}
              <span style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span
                  aria-hidden
                  style={{ flexShrink: 0, width: 11, height: 11, borderRadius: 4, background: linjeFarve(i), border: "1px solid rgba(76, 55, 24, 0.25)", marginTop: 4, display: "inline-block" }}
                />
                <span>{l.description}</span>
              </span>
              <b style={{ flexShrink: 0 }}>{linjeAcceptPrisTekst(l.price, privatKunde)}</b>
            </div>
            {/* Thomas, 2026-09-11 (korrektion): frekvens vises pr. linje — let
                læsbar kundevenlig form ("hver 6. uge" / "1 gang om året");
                engangsopgaver vises uden frekvenslinje. */}
            {l.interval ? (
              <small style={{ color: "#8A6931" }}>{l.interval.toLowerCase()}</small>
            ) : null}
            {/* Thomas, 2026-09-11 (korrektion 2): diskret startuge pr. linje
                ("Starter uge 29") — kun når linjen har en startuge. */}
            {l.startWeek ? (
              <small style={{ color: "#8A6931", display: "block" }}>{linjeStartugeTekst(l.startWeek)}</small>
            ) : null}
          </div>
        ))}
        {tilbud.startWeek ? (
          <p style={{ marginTop: 10, fontWeight: 600 }}>Start: {tilbud.startWeek}</p>
        ) : null}
        {/* Thomas, 2026-09-11 (korrektion): Årligt beløb = summen pr. linje
            (pris × besøg pr. år for hver linje med interval). */}
        {/* Thomas, 2026-09-11: 'samlet beløb' fjernet — ÅRLIGT beløb når intervallet er sat. */}
        {momsBund ? (
          <div style={{ background: "#FFF87B", borderRadius: 6, padding: "12px 14px", marginTop: 10 }}>
            <b style={{ fontSize: 17 }}>Årligt beløb: {krMoms(momsBund.ekskl)} (u. moms)</b>
            <div style={{ marginTop: 4 }}>Moms (25%): {krMoms(momsBund.moms)}</div>
            <div style={{ marginTop: 2, fontWeight: 700 }}>Ialt inkl. moms: {krMoms(momsBund.ialt)}</div>
          </div>
        ) : null}
      </div>

      {/* Thomas, 2026-09-11: ÅRSHJUL — kunden ser hele årets plan (alle
          opgavernes besøg pr. uge) SAMMEN MED TILBUDET. */}
      <Aarshjul uger={bygAarshjul(tilbud.lines)} />

      {kanGodkende ? (
        <form action={godkendAction} style={{ marginTop: 20 }}>
          <button type="submit" style={{ background: "#4C3718", color: "#FFF87B", border: 0, borderRadius: 8, padding: "14px 28px", fontSize: 17, fontWeight: 700, cursor: "pointer" }}>
            Godkend tilbud
          </button>
        </form>
      ) : accepted ? (
        <div style={{ marginTop: 20, background: "#4C3718", color: "#FFFFF0", borderRadius: 8, padding: 16 }}>
          <b style={{ color: "#FFF87B" }}>Tak — tilbuddet er godkendt!</b>
          <p style={{ margin: "6px 0 0" }}>Vi kontakter dig snarest for at aftale detaljerne.</p>
        </div>
      ) : tilbud.status === "udkast" ? (
        // Thomas, 2026-09-14: FORHÅNDSVISNING — teamet kan åbne /t/{token} fra
        // /tilbud/[id] for at se siden som kunden vil se den, FØR tilbuddet
        // sendes. Udkast kan ikke godkendes her (kanGodkende kræver status
        // 'sendt'), og linket er stadig hemmeligt (kun tokenet giver adgang).
        <div style={{ marginTop: 20, background: "#FFF87B", border: "2px dashed #8A6931", borderRadius: 8, padding: 16 }}>
          <b>Forhåndsvisning</b>
          <p style={{ margin: "6px 0 0" }}>
            Dette er en forhåndsvisning af, hvordan kunden vil se tilbuddet. Kunden kan ikke godkende endnu — tilbuddet skal først sendes.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <p>Linket er ikke aktivt længere — kontakt os på 22 22 38 33 eller hej@karltoffel.dk, så hører vi gerne fra dig.</p>
        </div>
      )}

      <p style={{ marginTop: 28, fontSize: 13, color: "#8A6931" }}>
        Spørgsmål? Ring 22 22 38 33 eller skriv hej@karltoffel.dk · Tilbuddet er gældende i 30 dage.
      </p>
    </div>
  );
}