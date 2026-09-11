import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { underLimit, recordHit } from "@/lib/rate-limit";
import { tilbudTotal } from "@/lib/tilbud.mts";

// Offentlig accept-side (Thomas, 2026-09-11): kunden klikker "Godkend tilbud" på
// /t/{token}. Ingen login — tokenet ER autorisationen, samme mønster som
// QuoteToken: atomic forbrug via updateMany (status='sendt' i where), så
// dobbelt-klik/prefetch kun kan acceptere én gang. Server action muterer og
// revalidatePath/redirect gøres via status-tjek efterfølgende.

export const metadata = { title: "Godkend tilbud · Karltoffel" };

const kr = (n: number) => n.toLocaleString("da-DK") + " kr.";

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

  const tilbud = await prisma.tilbud.findUnique({
    where: { acceptToken: token },
    include: {
      contact: { select: { name: true, companyName: true } },
      lines: { orderBy: { sort: "asc" }, select: { description: true, price: true } },
    },
  });
  if (!tilbud) notFound();

  const total = tilbudTotal(tilbud.lines);
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
          `Tilbud: ${titel} (samlet ${total.toLocaleString("da-DK")} kr.)\n` +
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
      </div>

      <div style={{ marginTop: 18 }}>
        {tilbud.lines.map((l, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #e8e0c8" }}>
            <span>{l.description}</span>
            <b>{kr(l.price)}</b>
          </div>
        ))}
        {tilbud.startWeek || tilbud.baseInterval ? (
          <p style={{ marginTop: 10, fontWeight: 600 }}>
            {[tilbud.startWeek ? `Start: ${tilbud.startWeek}` : null, tilbud.baseInterval ? `Interval: ${tilbud.baseInterval}` : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <div style={{ background: "#FFF87B", borderRadius: 6, padding: "12px 14px", marginTop: 10 }}>
          <b style={{ fontSize: 17 }}>Samlet pris: {kr(total)} (inkl. moms)</b>
        </div>
      </div>

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