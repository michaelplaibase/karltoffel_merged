// Beviser at en godkendelse ikke kan sende den samme mail til kunden to gange.
//
// Koer med en ENGANGS-database (aldrig mod produktion):
//   DATABASE_URL=... DIRECT_URL=... EMAIL_DRY_RUN=1 npx tsx scripts/lead-approve-race-smoke.ts
//
// Testen goer to ting:
//   1. Viser at det NAIVE moenster (laes status, send, skriv status) sender to
//      gange naar to tryk rammer samtidig. Uden det bevis kunne testen vaere
//      for ufoelsom til at fange fejlen overhovedet.
//   2. Viser at approveReply, som bruger en atomisk reservation, kun sender én.
import { PrismaClient } from "@prisma/client";
import { approveReply } from "../lib/lead-slack";

const prisma = new PrismaClient();

// Taeller afsendelser ved at lytte paa dry-run-linjen fra lib/email.ts.
let sendte = 0;
const rigtigLog = console.log;
console.log = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].includes("[email:dry-run]")) sendte++;
  rigtigLog(...a);
};

let fejl = 0;
function tjek(navn: string, betingelse: boolean, detalje: string) {
  if (betingelse) rigtigLog(`  ok   ${navn}`);
  else { fejl++; rigtigLog(`  FEJL ${navn}: ${detalje}`); }
}

async function nytUdkast(): Promise<number> {
  const company = await prisma.company.findFirst() ?? await prisma.company.create({ data: { name: "Testfirma" } });
  const lead = await prisma.lead.create({
    data: { companyId: company.id, name: "Test Testesen", email: "test@eksempel.dk", status: "new" },
  });
  const reply = await prisma.leadReply.create({
    data: { leadId: lead.id, version: 1, subject: "Emne", body: "Brødtekst", status: "draft" },
  });
  return reply.id;
}

/** Det naive moenster, praecis som koden saa ud foer fixet. Kun til sammenligning. */
async function naivGodkend(replyId: number): Promise<void> {
  const r = await prisma.leadReply.findUnique({ where: { id: replyId }, include: { lead: true } });
  if (!r || r.status !== "draft" || !r.lead.email) return;
  const { sendEmail } = await import("../lib/email");
  await sendEmail({ to: r.lead.email, subject: r.subject, text: r.body });
  await prisma.leadReply.update({ where: { id: replyId }, data: { status: "sent", sentAt: new Date() } });
}

async function main() {
  rigtigLog("\nNaivt moenster (som foer fixet), to samtidige tryk:");
  const a = await nytUdkast();
  sendte = 0;
  await Promise.all([naivGodkend(a), naivGodkend(a)]);
  const naivAntal = sendte;
  tjek("testen er foelsom nok til at fange fejlen", naivAntal === 2, `sendte ${naivAntal}, forventede 2`);

  rigtigLog("\napproveReply med atomisk reservation, to samtidige tryk:");
  const b = await nytUdkast();
  sendte = 0;
  const svar = await Promise.all([approveReply(b, "U_KRISTIAN"), approveReply(b, "U_KRISTIAN")]);
  tjek("kunden fik praecis én mail", sendte === 1, `sendte ${sendte}`);
  tjek("praecis ét tryk lykkedes", svar.filter((s) => s.ok).length === 1, JSON.stringify(svar));
  const efter = await prisma.leadReply.findUnique({ where: { id: b } });
  tjek("udkastet staar som sent", efter?.status === "sent", `status=${efter?.status}`);

  rigtigLog("\nTredje tryk paa et allerede sendt udkast:");
  sendte = 0;
  const igen = await approveReply(b, "U_KRISTIAN");
  tjek("afvist uden at sende", !igen.ok && sendte === 0, `ok=${igen.ok} sendte=${sendte}`);

  rigtigLog(fejl === 0 ? "\nAlle tjek bestaaet.\n" : `\n${fejl} tjek fejlede.\n`);
  await prisma.$disconnect();
  process.exit(fejl === 0 ? 0 : 1);
}

main().catch(async (e) => { rigtigLog("uventet fejl:", e); await prisma.$disconnect(); process.exit(1); });
