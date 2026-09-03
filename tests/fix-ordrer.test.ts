import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { routeId } from "../lib/route-ids";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// --- Afslut ordre: indtastning må ALDRIG gå tabt ved valideringsfejl (React 19 form-reset) ---

test("completeOrder ekkoer de indsendte felter i state.values ved fejl", async () => {
  const actions = await source("app/actions/orders.ts");
  // CompleteOrderState bærer values med alle fire felter …
  assert.match(actions, /CompleteOrderState = \{[\s\S]{0,300}values\?: \{ leveringsstatus: string; betaling: string; comment: string; addressNote: string \}/);
  // … og BEGGE fejl-returer (validering + slettet ordre) sender values med.
  assert.match(actions, /return \{ error: "Vælg en leveringsstatus\.", values \}/);
  assert.match(actions, /return \{ error: "Ordren findes ikke længere — den kan være slettet\.", values \}/);
});

// --- Færdigmeld-siden er simplificeret (Thomas 2026-09-03): tre valg i stedet ---
// for radioknapper: Færdigmeld (ét tryk), Flyt til anden dag (datovælger),
// Aflys (obligatorisk begrundelse). Formularen prefiller stadig kommentar fra
// state.values, og færdigmeld bruger kundens/global betalings-forudindstilling.

test("CompleteOrderForm viser tre enkle valg: færdigmeld, flyt, aflys", async () => {
  const form = await source("components/CompleteOrderForm.tsx");
  assert.match(form, /Færdigmeld opgave/);
  assert.match(form, /Flyt opgave til anden dag/);
  assert.match(form, /Aflys opgave/);
  // Ét tryk færdigmeld: leveringsstatus sendes som skjult felt, betaling via
  // kundens/global forudindstilling (paymentPreselect).
  assert.match(form, /name="leveringsstatus" value=\{mode === "aflys" \? "skip" : "udfoert"\}/);
  assert.match(form, /name="betaling" value=\{paymentPreselect\}/);
  // Aflys kræver altid en begrundelse (comment) — required felt.
  assert.match(form, /Hvorfor aflyses opgaven\?/);
  assert.match(form, /name="comment"[\s\S]{0,200}required/);
  // Flyt: egen server action med datovælger.
  assert.match(form, /type="date" required/);
  const page = await source("app/orders/[id]/complete/page.tsx");
  assert.match(page, /moveAction=\{moveOrderToDate\.bind/);
});

test("moveOrderToDate flytter ordren til valgt dato og revaliderer", async () => {
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /export async function moveOrderToDate\(/);
  assert.match(actions, /\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(raw\)/);
  assert.match(actions, /plannedAt: new Date\(`\$\{raw\}T10:00:00Z`\)/);
});

test("Opret ordre: uge- og medarbejdervalg overlever en valideringsfejl", async () => {
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /OrderCreateState = \{ error\?: string; values\?: \{ week: string; employeeId: string \} \}/);
  assert.match(actions, /return \{ error: "Vælg en kunde\.", values \}/);
  assert.match(actions, /return \{ error: "Tilføj mindst én opgave\.", values \}/);
  const form = await source("components/OrderCreateForm.tsx");
  assert.match(form, /name="week" defaultValue=\{v\?\.week \?\? weekOptions\[0\]\?\.value\}/);
  assert.match(form, /name="employeeId" defaultValue=\{v\?\.employeeId \?\? ""\}/);
});

// --- completeOrder: guard mod slettet ordre + completedAt kun første gang ---

test("completeOrder slår ordren op før update (ingen P2025-crash)", async () => {
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /findUnique\(\{ where: \{ id: orderId \}, select: \{ completedAt: true, contactId: true \} \}\)/);
  // Opslag + venlig fejl SKAL ligge før selve update-kaldet i completeOrder.
  const body = actions.slice(actions.indexOf("export async function completeOrder"));
  assert.ok(body.indexOf("findes ikke længere") < body.indexOf("await prisma.order.update"));
});

test("completedAt overskrives ikke ved genafslutning", async () => {
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /leveringsstatus === "udfoert" && !order\.completedAt \? \{ completedAt: new Date\(\) \}/);
});

// --- 'Fakturér igen' vises i ALLE fejlscenarier (også bogført-men-afsendelse-fejlet) ---

test("retry-knappen vises også når dineroError er sat ved Booked/Sent-status", async () => {
  const page = await source("app/orders/[id]/page.tsx");
  assert.match(page, /o\.dineroInvoiceStatus === "Failed" \|\|[\s\S]{0,400}!!o\.dineroError \|\|/);
  assert.match(page, /Fakturér igen/);
});

// --- Samlefaktura-status (erhverv) vises ærligt på ordresiden ---

test("ordresiden viser businessBatch-status, fakturanr. og seneste fejl", async () => {
  const page = await source("app/orders/[id]/page.tsx");
  assert.match(page, /businessBatchInvoiceStatus: true, businessBatchInvoiceNumber: true, businessBatchError: true/);
  assert.match(page, /Månedlig samlefakturering \(erhverv\)/);
  assert.match(page, /isCompany/);
  // Kun visning — dobbeltfakturerings-logikken ejes af lib/business-invoicing.ts.
  assert.doesNotMatch(page, /runBusinessBatchInvoicing/);
});

// --- Afslut ordre-flow: ?back=<relativ sti> fra alle indgange, whitelistet ---

test("complete-siden accepterer kun interne stier som back (aldrig //host)", async () => {
  const page = await source("app/orders/[id]/complete/page.tsx");
  // Verifikationsfund: "/\\evil.com" OG "/\t/evil.com" normaliseres af
  // browsere til "//evil.com" — whitelisten afviser derfor backslash og
  // ALLE kontroltegn/whitespace, ikke kun det ledende "//".
  assert.match(page, /sp\.back\.startsWith\("\/"\) && !sp\.back\.startsWith\("\/\/"\)/);
  assert.match(page, /x00-\\x20/);
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /rawBack\.startsWith\("\/"\) && !rawBack\.startsWith\("\/\/"\)/);
  assert.match(actions, /x00-\\x20/);
});

test("dagsprogram, ordreliste og kundeside sender ?back med til Afslut ordre", async () => {
  const dayCard = await source("components/DayStopCard.tsx");
  assert.match(dayCard, /\/complete\?back=\$\{backParam\}/);
  assert.match(dayCard, /usePathname|useSearchParams/);
  const orders = await source("app/orders/page.tsx");
  assert.match(orders, /\/complete\?back=\$\{encodeURIComponent\(listUrl\)\}/);
  const customer = await source("components/CustomerOrdersTable.tsx");
  assert.match(customer, /\/complete\?back=\$\{encodeURIComponent\(`\/customers\/\$\{o\.contactId\}`\)\}/);
});

// --- 'Vælges automatisk (nærmeste ledige)' lovede noget planneren aldrig gør ---

test("medarbejder-dropdown lover ikke længere 'nærmeste ledige'", async () => {
  const form = await source("components/OrderCreateForm.tsx");
  assert.doesNotMatch(form, /Vælges automatisk \(nærmeste ledige\)|nærmeste medarbejder/);
  assert.match(form, /Tildeles \$\{employees\[0\]\.name\} \(automatisk\)/);
});

// --- Falsk forfalden: ordre i indeværende uge plantes på dags dato, ikke mandag ---

test("createOrder planter indeværende uge på dags dato (Europe/Copenhagen, kl 10 UTC)", async () => {
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /const todayAt10 = new Date\(`\$\{todayCphISO\(\)\}T10:00:00Z`\)/);
  assert.match(actions, /week && week !== weekMondayToday\(\) \? new Date\(`\$\{week\}T10:00:00Z`\) : todayAt10/);
});

// --- Nat-cron planlægger hele horisonten, ikke kun indeværende uge ---

test("/api/plan uden ?week looper planAndPersistWeek over 26 uger", async () => {
  const route = await source("app/api/plan/route.ts");
  assert.match(route, /const HORIZON_WEEKS = 26/);
  assert.match(route, /for \(let i = 0; i < HORIZON_WEEKS; i\+\+\)/);
  assert.match(route, /await planAndPersistWeek\(monday\)/);
  // ?week-adfærden er bevaret som enkelt-uge.
  assert.match(route, /if \(weekParam\) \{[\s\S]{0,400}planAndPersistWeek\(weekParam\)/);
});

// --- Ordreliste: server-side paginering + ærlig tooltip ---

test("/orders bruger getOrdersPage (server-side paginering)", async () => {
  const page = await source("app/orders/page.tsx");
  assert.match(page, /getOrdersPage\(q, Number\(sp\.page\) \|\| 1\)/);
  assert.doesNotMatch(page, /getOrders\(q\)|paginate\(/);
});

test("leveringsdato-tooltip skelner afsluttet / i dag / fremtid", async () => {
  const page = await source("app/orders/page.tsx");
  assert.match(page, /Ordren er afsluttet/);
  assert.match(page, /Ordren leveres i dag/);
  assert.match(page, /Ordren ligger i fremtiden/);
  assert.match(page, /Ordren er ikke afsluttet/);
});

// --- Slet ordre: bliv hvor du er ---

test("kundesiden sletter med redirectTo=null og deleteOrder revaliderer kundesiden", async () => {
  const customer = await source("components/CustomerOrdersTable.tsx");
  assert.match(customer, /deleteOrder\(o\.id, null\)/);
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /revalidatePath\(`\/customers\/\$\{o\.contactId\}`\)/);
});

test("/orders sletter med den aktuelle liste-URL (søgning + side bevares)", async () => {
  const page = await source("app/orders/page.tsx");
  assert.match(page, /deleteOrder\.bind\(null, o\.id, listUrl\)/);
});

// --- Kundens forudindstilling for 'Betaling og fakturering' anvendes ---

test("complete-siden henter invoiceChoicePreselect og sender den til formularen", async () => {
  const page = await source("app/orders/[id]/complete/page.tsx");
  assert.match(page, /invoiceChoicePreselect: true/);
  assert.match(page, /!o\.invoiceDecision && isInvoiceDecision\(preselect\) \? preselect : undefined/);
  assert.match(page, /paymentPreselect=\{paymentPreselect\}/);
});

// --- Tombstone på rytme-ugen: moveOrderWeeks backfiller sourceWeek for legacy-rækker ---

test("moveOrderWeeks backfiller sourceWeek før flytning (uden unique-kollision)", async () => {
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /o\.subscriptionId != null && o\.sourceWeek == null/);
  assert.match(actions, /subscriptionId: o\.subscriptionId, sourceWeek: candidate, NOT: \{ id: orderId \}/);
  assert.match(actions, /sourceWeekFix = \{ sourceWeek: candidate \}/);
});

// --- routeId på alle ordre-id-sider (404 i stedet for rå Prisma-fejl) ---

test("alle /orders/[id]-sider bruger routeId", async () => {
  for (const p of ["app/orders/[id]/page.tsx", "app/orders/[id]/complete/page.tsx", "app/orders/[id]/send-tilbud/page.tsx"]) {
    const src = await source(p);
    assert.match(src, /routeId\(id\)/, p);
    assert.match(src, /from "@\/lib\/route-ids"/, p);
  }
});

// --- Ren enhedstest: routeId er streng (positivt heltal eller 404) ---

test("routeId parser numeriske id'er og kaster notFound på alt andet", () => {
  assert.equal(routeId("12"), 12);
  assert.equal(routeId("000000001"), 1);
  for (const bad of ["abc", "12abc", "-3", "1.5", "", undefined, "1234567890"]) {
    assert.throws(() => routeId(bad as string | undefined), `routeId(${String(bad)}) burde kaste notFound`);
  }
});
