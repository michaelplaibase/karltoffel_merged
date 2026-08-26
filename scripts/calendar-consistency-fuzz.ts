// FUZZ-tjek af kalender-invarianten: "ALLE ordrer er ALTID i dagskalenderen".
//
//   npx tsx scripts/calendar-consistency-fuzz.ts [iterationer=30] [seed=1]
//
// Hver iteration bygger en TILFÆLDIG uge-konfiguration i databasen — tilfældigt
// antal ordrer med tilfældige medarbejdere (inkl. ingen og kalender-inaktive),
// låste ugedage (inkl. weekend), varigheder fra 15 min til kæmpe-overløb, og
// sommetider en ferieuge — og efterprøver derefter:
//   1) checkWeekConsistency: partition + dag==uge + tal (samme kerne som det
//      natlige produktions-tjek), og
//   2) viewer-reglen: hver medarbejders dagsprogram er præcis egen delmængde.
// Alt ryddes op efter hver iteration. Deterministisk via seed (LCG), så et
// fund altid kan genskabes med samme seed.
import { prisma } from "../lib/db";
import { checkWeekConsistency } from "../lib/calendar-consistency";
import { getDayProgram } from "../lib/queries";

// Lille deterministisk LCG — Math.random ville gøre fund ureproducerbare.
let rngState = 1;
const rnd = () => (rngState = (rngState * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const irnd = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const FUZZ_WEEK = "2027-03-01"; // fast fremtids-uge — rører aldrig rigtige data
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

async function main() {
  const iterations = Number(process.argv[2]) || 30;
  rngState = Number(process.argv[3]) || 1;
  const seed = rngState;

  const company = await prisma.company.findFirstOrThrow();
  const contact = await prisma.contact.create({ data: { companyId: company.id, name: "FUZZ Kunde", street: "Fuzzvej 1", city: "8700 Horsens", isCompany: false } });
  const activeUsers = await prisma.user.findMany({ where: { activeCalendar: true, active: true }, orderBy: { id: "asc" } });
  const inactive = await prisma.user.create({ data: { companyId: company.id, username: `fuzz-inaktiv-${seed}`, firstName: "Fuzz", lastName: "Inaktiv", active: true, activeCalendar: false, isAdmin: false } });
  if (!activeUsers.length) throw new Error("fuzz kræver mindst én aktiv kalender-bruger (kør seed først)");

  const POSTALS = ["8660 Skanderborg", "8700 Horsens", "8000 Aarhus C", "8300 Odder", "8600 Silkeborg"];
  let failures = 0;

  for (let iter = 1; iter <= iterations; iter++) {
    const orderCount = irnd(0, 18);
    const withHoliday = rnd() < 0.2;
    const holiday = withHoliday
      ? await prisma.holidayWeek.create({ data: { startWeek: new Date(`${FUZZ_WEEK}T00:00:00Z`), endWeek: new Date(`${FUZZ_WEEK}T00:00:00Z`) } })
      : null;

    const ids: number[] = [];
    for (let k = 0; k < orderCount; k++) {
      const empRoll = rnd();
      const employeeId = empRoll < 0.15 ? null : empRoll < 0.3 ? inactive.id : pick(activeUsers).id;
      const weekday = irnd(0, 6); // inkl. weekend
      const locked = rnd() < 0.3;
      const o = await prisma.order.create({ data: {
        contactId: contact.id,
        deliveryAddress: `Fuzzvej ${k + 1}, ${pick(POSTALS)}`,
        plannedAt: new Date(Date.parse(`${addDays(FUZZ_WEEK, weekday)}T10:00:00Z`)),
        sourceType: "manual", employeeId, lockedFully: locked,
        status: pick(["Afventer levering", "Udført", "Skal genplanlægges", "Sprunget over"]),
        tasks: { create: [{ category: pick(["Vinduespudsning", "Grøn service", "Andet"]), letter: "F", color: "#ccc", description: `FUZZ ${iter}-${k}`, price: irnd(0, 900), durationMin: pick([0, 15, 45, 90, 240, 1200]), sort: 0 }] },
      } });
      ids.push(o.id);
    }

    // 1) Kerne-invarianten (samme tjek som det natlige produktions-vagtværn).
    const core = await checkWeekConsistency(FUZZ_WEEK);
    if (!core.ok || core.orders !== orderCount) {
      failures++;
      console.error(`✗ iter ${iter} (seed ${seed}, ${orderCount} ordrer${withHoliday ? ", ferie" : ""}):`);
      if (core.orders !== orderCount) console.error(`    DB-antal afviger: forventede ${orderCount}, tjekket så ${core.orders}`);
      for (const p of core.problems) console.error(`    [${p.kind}] ${p.detail}`);
    }

    // 2) Viewer-reglen: hver medarbejders dagsprogram = præcis egen delmængde.
    const adminDays = await Promise.all(Array.from({ length: 7 }, (_, i) => getDayProgram(addDays(FUZZ_WEEK, i))));
    for (const u of activeUsers.slice(0, 2)) {
      const name = `${u.firstName} ${u.lastName}`;
      for (let i = 0; i < 7; i++) {
        const own = await getDayProgram(addDays(FUZZ_WEEK, i), { id: u.id, isAdmin: false });
        const expected = adminDays[i].stops.filter((s) => s.employee === name).map((s) => s.orderId).sort((a, b) => a - b);
        const got = own.stops.map((s) => s.orderId).sort((a, b) => a - b);
        if (JSON.stringify(got) !== JSON.stringify(expected)) {
          failures++;
          console.error(`✗ iter ${iter} viewer (${name}, dag ${i}): [${got}] ≠ egen delmængde [${expected}]`);
        }
      }
    }

    // Ryd op — fuzz-ugen skal være tom før næste iteration.
    await prisma.taskLine.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    if (holiday) await prisma.holidayWeek.delete({ where: { id: holiday.id } });
    if (iter % 10 === 0) console.log(`  … ${iter}/${iterations} iterationer, ${failures} fejl`);
  }

  await prisma.user.delete({ where: { id: inactive.id } });
  await prisma.contact.delete({ where: { id: contact.id } });

  if (failures) { console.error(`\nFEJL: ${failures} invariant-brud over ${iterations} tilfældige konfigurationer (seed ${seed}).`); process.exit(1); }
  console.log(`\nOK: kalender-invarianten holdt i alle ${iterations} tilfældige uge-konfigurationer (seed ${seed}) — hver eneste ordre var i dagskalenderen præcis én gang.`);
}

main().finally(() => prisma.$disconnect());
