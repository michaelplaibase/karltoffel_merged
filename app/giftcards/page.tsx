// Gavekort-ordrer (/giftcards). Fase 0-flowet: bestilling fra sitet → teamet
// sender MobilePay-betalingsanmodning manuelt → "Markér som betalt" her
// (genererer koden) → kortet sendes pr. mail → "Markér som sendt".
import { prisma } from "@/lib/db";
import { markGiftCardPaid, markGiftCardSent, cancelGiftCard } from "@/app/actions/giftcards";

export const metadata = { title: "Gavekort · Karltoffel Business Manager" };
// Prisma-data ved hvert request — må ikke prerenderes ved build.
export const dynamic = "force-dynamic";

const kr = (minor: number) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(minor / 100);

const statusLabel: Record<string, string> = {
  awaiting_payment: "Afventer betaling",
  paid: "Betalt — send kortet",
  sent: "Sendt",
  cancelled: "Annulleret",
};
const statusStyle: Record<string, React.CSSProperties> = {
  awaiting_payment: { background: "#8a6d1a", color: "#fff" },
  paid: { background: "#1f7a33", color: "#fff" },
  sent: { background: "#555", color: "#fff" },
  cancelled: { background: "#a33", color: "#fff" },
};

function fmtDate(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" }).format(d) : "—";
}

export default async function GiftCardsPage() {
  const orders = await prisma.giftCardOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <h1>Gavekort</h1>
      <p style={{ color: "#666" }}>
        Fase 0: betaling sker manuelt via MobilePay Business-appen. Markér betalingen når anmodningen er
        indfriet — koden genereres da automatisk og pinges i Slack. Send derefter kortet pr. mail til
        modtageren og markér som sendt.
      </p>
      {orders.length === 0 ? (
        <p>Ingen gavekort-ordrer endnu.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem", marginTop: "1rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th style={cell}>Oprettet</th>
              <th style={cell}>Beløb</th>
              <th style={cell}>Til</th>
              <th style={cell}>Fra</th>
              <th style={cell}>Besked</th>
              <th style={cell}>Kode</th>
              <th style={cell}>Status</th>
              <th style={cell}>Handling</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #ddd", verticalAlign: "top" }}>
                <td style={cell}>{fmtDate(o.createdAt)}</td>
                <td style={cell}>{kr(o.amountMinor)} kr.</td>
                <td style={cell}>
                  {o.recipientName}
                  <br />
                  <a href={`mailto:${o.recipientEmail}`}>{o.recipientEmail}</a>
                </td>
                <td style={cell}>
                  {o.buyerName}
                  <br />
                  <a href={`mailto:${o.buyerEmail}`}>{o.buyerEmail}</a>
                  <br />
                  📱 {o.buyerPhone}
                  <br />
                  <span style={{ fontSize: ".8rem", color: "#666" }}>{o.design}</span>
                </td>
                <td style={{ ...cell, maxWidth: 220 }}>{o.message}</td>
                <td style={cell}>
                  <strong style={{ letterSpacing: ".05em" }}>{o.code ?? "—"}</strong>
                  {o.sentAt && (
                    <>
                      <br />
                      <span style={{ fontSize: ".8rem", color: "#666" }}>sendt {fmtDate(o.sentAt)}</span>
                    </>
                  )}
                </td>
                <td style={cell}>
                  <span style={{ ...statusStyle[o.status], padding: ".2rem .6rem", borderRadius: "999px", fontSize: ".8rem", whiteSpace: "nowrap" }}>
                    {statusLabel[o.status] ?? o.status}
                  </span>
                </td>
                <td style={cell}>
                  {o.status === "awaiting_payment" && (
                    <form action={markGiftCardPaid.bind(null, o.id)}>
                      <button type="submit" style={btnPrimary}>Markér som betalt</button>
                    </form>
                  )}
                  {o.status === "paid" && (
                    <form action={markGiftCardSent.bind(null, o.id)}>
                      <button type="submit" style={btnPrimary}>Markér som sendt</button>
                    </form>
                  )}
                  {o.status === "awaiting_payment" && (
                    <form action={cancelGiftCard.bind(null, o.id)}>
                      <button type="submit" style={btnGhost}>Annuller</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const cell: React.CSSProperties = { padding: ".6rem .5rem" };
const btnPrimary: React.CSSProperties = { cursor: "pointer", padding: ".4rem .8rem", borderRadius: ".5rem", border: "none", background: "#1f7a33", color: "#fff", fontWeight: 600 };
const btnGhost: React.CSSProperties = { cursor: "pointer", padding: ".4rem .8rem", borderRadius: ".5rem", border: "1px solid #a33", background: "transparent", color: "#a33", marginTop: ".4rem" };
