// Konsistens-tjek: /calendar (uge) og /daycalendar (dagsprogram) skal ALTID
// vise det samme — samme ordrer, samme dage, samme tider, samme tal.
//
//   npx tsx scripts/calendar-daycal-consistency-check.ts [ugemandag ...] [--persist]
//
// Uden argumenter tjekkes den aktuelle uge (Europe/Copenhagen). Pr. uge:
//   1. PARTITION  — hver DB-ordre i ugen optræder præcis én gang på tværs af
//                   ugekalenderens events + "Ikke planlagt" (og aldrig begge).
//   2. DAG==UGE   — dagsprogrammets stops matcher ugekalenderens events for
//                   samme dag (id, klokkeslæt), og unplanned-sektionen matcher
//                   ugens "Ikke planlagt" på ordrens persisterede ugedag.
//   3. TAL        — dagsomsætning og kørsel er ens i begge visninger; ugetal
//                   er ens på tværs af alle ugens dagsprogrammer.
//   4. VIEWER     — en almindelig medarbejder ser præcis delmængden af
//                   admin-visningen der tilhører hende/ham selv.
//   5. --persist  — planAndPersistWeek (natte-cronen) er konvergent: anden
//                   kørsel ændrer intet, og visningen er identisk før/efter.
import { prisma } from "../lib/db";
import { getCalendarWeek, getDayProgram, planAndPersistWeek } from "../lib/queries";
import { todayCphISO } from "../lib/calendar";
import { fmtTime } from "../lib/planner";

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
};
const sortNum = (xs: number[]) => [...xs].sort((a, b) => a - b);

let failures = 0;
const fail = (week: string, msg: string) => { failures++; console.error(`  ✗ [${week}] ${msg}`); };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

async function checkWeek(monday: string, persist: boolean) {
  console.log(`\nUge der starter ${monday}:`);
  const week = await getCalendarWeek(monday);
  const days = await Promise.all(Array.from({ length: 7 }, (_, i) => getDayProgram(addDays(monday, i))));

  // 1) Partition: DB-ordrer i ugen == events ∪ unplanned, hver præcis én gang.
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(start.getTime() + 7 * 864e5);
  const dbOrders = await prisma.order.findMany({ where: { plannedAt: { gte: start, lt: end } }, select: { id: true } });
  const eventIds = week.events.map((e) => e.id);
  const unplannedIds = week.unplanned.map((u) => u.id);
  const union = sortNum([...eventIds, ...unplannedIds]);
  if (new Set(union).size !== union.length) fail(monday, "en ordre optræder mere end én gang i ugekalenderen (events/unplanned)");
  if (JSON.stringify(union) !== JSON.stringify(sortNum(dbOrders.map((o) => o.id))))
    fail(monday, `ugekalenderen dækker ikke præcis DB'ens ordrer (DB: ${dbOrders.length}, vist: ${union.length})`);
  else ok(`partition: alle ${dbOrders.length} ordrer vises præcis én gang (${eventIds.length} planlagt, ${unplannedIds.length} ikke planlagt)`);

  // 2) Dag == uge, dag for dag (id + klokkeslæt for stops; id for unplanned).
  for (let i = 0; i < 7; i++) {
    const evs = week.events.filter((e) => e.day === i).map((e) => `${e.id}@${fmtTime(Math.round(e.start * 60))}-${fmtTime(Math.round(e.end * 60))}`).sort();
    const stops = days[i].stops.map((s) => `${s.orderId}@${s.from}-${s.to}`).sort();
    if (JSON.stringify(evs) !== JSON.stringify(stops))
      fail(monday, `dag ${i}: stops afviger fra ugekalenderen\n      uge: ${evs.join(", ") || "-"}\n      dag: ${stops.join(", ") || "-"}`);
  }
  const dayUnplannedUnion = sortNum(days.flatMap((d) => d.unplanned.map((u) => u.orderId)));
  if (JSON.stringify(dayUnplannedUnion) !== JSON.stringify(sortNum(unplannedIds)))
    fail(monday, `unplanned afviger: uge=[${sortNum(unplannedIds)}] dage=[${dayUnplannedUnion}]`);
  if (!failures) ok("dag == uge: alle 7 dagsprogrammer matcher ugekalenderen (stops, tider og unplanned)");

  // 3) Tal: dagsomsætning, kørsel og ugetotal.
  for (let i = 0; i < 7; i++) {
    if (week.days[i].revenue !== days[i].revenueDay)
      fail(monday, `dag ${i}: omsætning uge=${week.days[i].revenue} dag=${days[i].revenueDay}`);
    const wkDrive = week.days[i].driving ?? "0 t 0 min";
    if (wkDrive !== days[i].driving)
      fail(monday, `dag ${i}: kørsel uge='${wkDrive}' dag='${days[i].driving}'`);
    if (days[i].revenueWeek !== week.planned.week)
      fail(monday, `dag ${i}: ugeomsætning dag=${days[i].revenueWeek} uge=${week.planned.week}`);
  }
  ok("tal: omsætning (dag/uge) og kørsel stemmer i begge visninger");

  // 4) Viewer-reglen: medarbejder-visningen er præcis egen delmængde af admin.
  const users = await prisma.user.findMany({ where: { activeCalendar: true }, orderBy: { id: "asc" }, take: 3 });
  for (const u of users) {
    const name = `${u.firstName} ${u.lastName}`;
    const wkEmp = await getCalendarWeek(monday, { id: u.id, isAdmin: false });
    const expected = sortNum(week.events.filter((e) => e.employeeId === u.id).map((e) => e.id));
    if (JSON.stringify(sortNum(wkEmp.events.map((e) => e.id))) !== JSON.stringify(expected))
      fail(monday, `viewer uge (${name}): ser ikke præcis egne ordrer`);
    for (let i = 0; i < 7; i++) {
      const dEmp = await getDayProgram(addDays(monday, i), { id: u.id, isAdmin: false });
      const expDay = days[i].stops.filter((s) => s.employee === name).map((s) => s.orderId);
      if (JSON.stringify(sortNum(dEmp.stops.map((s) => s.orderId))) !== JSON.stringify(sortNum(expDay)))
        fail(monday, `viewer dag ${i} (${name}): ser ikke præcis egne stops`);
      for (const un of dEmp.unplanned)
        if (!unplannedIds.includes(un.orderId)) fail(monday, `viewer dag ${i} (${name}): unplanned #${un.orderId} findes ikke i admin-visningen`);
    }
  }
  ok(`viewer: ${users.length} medarbejderes visning er præcis deres egen delmængde`);

  // 5) Konvergens: natte-persisteringen ændrer intet i anden kørsel og
  //    ændrer ikke visningen.
  if (persist) {
    const snapshot = (xs: { id: number; plannedAt: Date; employeeId: number | null }[]) =>
      JSON.stringify(xs.map((o) => [o.id, o.plannedAt.toISOString(), o.employeeId]).sort((a, b) => Number(a[0]) - Number(b[0])));
    const view = (w: Awaited<ReturnType<typeof getCalendarWeek>>) =>
      JSON.stringify(w.events.map((e) => [e.id, e.day, e.start, e.end, e.employeeId]).sort((a, b) => Number(a[0]) - Number(b[0])));
    const before = view(week);
    await planAndPersistWeek(monday);
    const s1 = snapshot(await prisma.order.findMany({ where: { plannedAt: { gte: start, lt: end } }, select: { id: true, plannedAt: true, employeeId: true } }));
    await planAndPersistWeek(monday);
    const s2 = snapshot(await prisma.order.findMany({ where: { plannedAt: { gte: start, lt: end } }, select: { id: true, plannedAt: true, employeeId: true } }));
    if (s1 !== s2) fail(monday, "planAndPersistWeek er ikke idempotent — anden kørsel ændrede plannedAt/employeeId");
    const after = view(await getCalendarWeek(monday));
    if (before !== after) fail(monday, "visningen ændrede sig af at persistere planen (feedback-loop)");
    if (s1 === s2 && before === after) ok("persist: natte-planlægningen er konvergent (idempotent, visning uændret)");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const persist = args.includes("--persist");
  const weeks = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)).map(mondayOf);
  if (!weeks.length) weeks.push(mondayOf(todayCphISO()));
  for (const w of weeks) await checkWeek(w, persist);
  console.log(failures ? `\nFEJL: ${failures} uoverensstemmelse(r) fundet.` : "\nOK: kalender og dagsprogram er 100% synkrone.");
  process.exit(failures ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
