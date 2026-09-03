import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GUIDES } from "../lib/guides";
import { navForRole, TOP_NAV } from "../lib/nav";
import { buildSettingsPage, PLANNER_STATUS_NOTE, SETTINGS_PAGES } from "../lib/settings-config";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// --- KRITISK: ingen credentials i vejledningerne ---

test("vejledningerne indeholder hverken seed-adminens kodeord eller brugernavn", () => {
  const alt = JSON.stringify(GUIDES);
  // Adgangskoden "karltoffel" og brugernavnet må ALDRIG stå i hjælpetekster,
  // som alle loggede brugere kan læse.
  assert.doesNotMatch(alt, /adgangskode/i);
  assert.ok(!alt.includes("kristianklercke"));
  // Erstatningen henviser i stedet til administratoren.
  assert.match(alt, /login udleveres af administratoren/);
});

// --- HØJ: React 19 form-reset — indtastning overlever valideringsfejl ---

test("createUser/updateUser ekkoer de indsendte værdier i alle fejl-states", async () => {
  const actions = await source("app/actions/users.ts");
  assert.match(actions, /values\?: Record<string, string>/);
  // Hver valideringsfejl bærer values med (stikprøver på de kendte fejl).
  assert.match(actions, /Adgangskoden skal være mindst 8 tegn\.", values/);
  assert.match(actions, /Brugernavnet er allerede taget\.", values/);
  assert.match(actions, /Beløb\/sats skal være et positivt tal\.", values/);
  // Adgangskoden ekkoes aldrig tilbage.
  assert.doesNotMatch(actions, /values[^=]*=[^;]*\bpassword\b[^;]*;/);
});

test("opret-/rediger-bruger-formularerne prefiller med state.values", async () => {
  const manager = await source("components/UserManager.tsx");
  assert.match(manager, /defaultValue=\{state\.values\?\.firstName \?\? ""\}/);
  assert.match(manager, /defaultValue=\{state\.values\?\.username \?\? ""\}/);
  const form = await source("components/UserForm.tsx");
  assert.match(form, /const v = \(felt: string, ellers: string\) => state\.values\?\.\[felt\] \?\? ellers/);
  assert.match(form, /defaultValue=\{v\("username", initial\.username\)\}/);
  assert.match(form, /vCheck\("canSeePrices", initial\.canSeePrices\)/);
});

test("lønmodel-skift nulstiller beløbsfeltet (kr/md ≠ %) og satser over 100 % afvises", async () => {
  const form = await source("components/UserForm.tsx");
  assert.match(form, /setPayModel\(e\.target\.value as "fast" \| "akkord"\); setBelob\(""\);/);
  const manager = await source("components/UserManager.tsx");
  assert.match(manager, /setModel\(e\.target\.value as "fast" \| "akkord"\);\s*\n\s*setBelob\(""\);/);
  assert.match(manager, /setCreatePay\(e\.target\.value as "fast" \| "akkord"\); setCreateBelob\(""\);/);
  assert.match(manager, /Provisionssats skal være 0–100 %\./);
  const actions = await source("app/actions/users.ts");
  assert.match(actions, /payModel === "akkord" && belob != null && belob > 100/);
});

// --- HØJ: frustrationsrapport — screenshots komprimeres under 1 MB-loftet ---

test("FrustrationButton nedskalerer screenshots client-side til under ~900 KB", async () => {
  const comp = await source("components/FrustrationButton.tsx");
  assert.match(comp, /const MAX_SCREENSHOT_BYTES = 900 \* 1024/);
  assert.match(comp, /createImageBitmap\(file\)/);
  assert.match(comp, /canvas\.toBlob\(res, "image\/jpeg", quality\)/);
  // Venlig fejl FØR indsendelse + submit blokeret, til filen er ombestemt.
  assert.match(comp, /Billedet kan ikke komprimeres til under ca\. 900 KB/);
  assert.match(comp, /disabled=\{pending \|\| processing \|\| fileError != null\}/);
  // Den komprimerede fil erstatter det rå filvalg i FormData'en.
  assert.match(comp, /fd\.set\("screenshot", shot\)/);
  const action = await source("app/actions/frustration.ts");
  assert.match(action, /const MAX_SCREENSHOT_BYTES = 900 \* 1024/);
  assert.doesNotMatch(action, /3 \* 1024 \* 1024/);
});

test("frustrationsknappen kan bruges flere gange pr. sideindlæsning", async () => {
  const comp = await source("components/FrustrationButton.tsx");
  // Modalen (inkl. dens useActionState) monteres kun mens den er åben — luk
  // afmonterer den, så state.sent aldrig hænger fast til næste rapport.
  assert.match(comp, /\{open && <ReportModal pathname=\{pathname\} onClose=\{\(\) => setOpen\(false\)\} \/>\}/);
  assert.match(comp, /function ReportModal\(/);
  const modal = comp.slice(comp.indexOf("function ReportModal"));
  assert.match(modal, /useActionState<FrustrationReportState, FormData>\(submitFrustrationReport, \{\}\)/);
});

// --- Admin-afgrænsning: virksomhedsbrede actions + navigation ---

test("guardAdminAction findes og bruges af alle settings-/skabelon-/minutpris-actions", async () => {
  const auth = await source("lib/api-auth.ts");
  assert.match(auth, /export async function guardAdminAction\(\): Promise<void>/);
  assert.match(auth, /if \(me == null\) redirect\("\/login"\);\s*\n\s*if \(!me\.isAdmin\) redirect\("\/"\);/);
  const actions = await source("app/actions/settings.ts");
  assert.equal((actions.match(/await guardAdminAction\(\);/g) ?? []).length, 3);
  // Den svage "er logget ind"-guard er helt væk fra settings-actions.
  assert.doesNotMatch(actions, /\bguardAction\b/);
});

test("navForRole skjuler admin-punkter for ikke-admins og fjerner tomme menuer", () => {
  const hrefs = (menus: ReturnType<typeof navForRole>) => menus.flatMap((m) => m.items.map((i) => i.href));
  const medarbejder = hrefs(navForRole(false));
  for (const adminHref of ["/users", "/payroll", "/accounting", "/settings", "/templates", "/reports/graphs"]) {
    assert.ok(!medarbejder.includes(adminHref), `${adminHref} må ikke vises for ikke-admins`);
  }
  // Fælles sider består for alle — og alt andet (timesheet, guides,
  // discount-codes m.fl.) er nu adminOnly efter rollebegrænsningen.
  for (const fri of ["/calendar", "/customers", "/orders", "/reports/day-pdf"]) {
    assert.ok(medarbejder.includes(fri), `${fri} skal vises for alle`);
  }
  for (const kunAdmin of ["/guides", "/timesheet", "/discount-codes", "/group-messages", "/holidays", "/optimization", "/price-adjustments", "/standard-tasks", "/partners", "/quiz", "/support", "/ai-receptionist"]) {
    assert.ok(!medarbejder.includes(kunAdmin), `${kunAdmin} må ikke vises for ikke-admins`);
  }
  // Admin ser den fulde menu, og "Rapportering" forsvinder ikke for en
  // medarbejder (dagsprogram-PDF'en er ikke admin-gated).
  assert.deepEqual(navForRole(true), TOP_NAV);
  assert.ok(medarbejder.includes("/reports/day-pdf"));
});

test("Navbar henter rollen server-side og renderer den filtrerede menu", async () => {
  const navbar = await source("components/Navbar.tsx");
  assert.match(navbar, /getSessionIsAdmin\(\)\.then/);
  assert.match(navbar, /const nav = navForRole\(isAdmin\)/);
  assert.doesNotMatch(navbar, /TOP_NAV\.map/);
});

// --- Deaktivér/genaktivér: kalender-flaget divergerer aldrig ---

test("deaktivering husker activeCalendar, og genaktivering genopretter det", async () => {
  const actions = await source("app/actions/users.ts");
  assert.match(actions, /stash\[String\(userId\)\] = \[target\.activeCalendar \? "1" : "0"\]/);
  assert.match(actions, /const activeCalendar = husket == null \? true : husket === "1"/);
  assert.match(actions, /data: \{ active: true, activeCalendar \}/);
});

test("'Aktiv kalender' kan ikke slås til på en deaktiveret bruger", async () => {
  const actions = await source("app/actions/users.ts");
  assert.match(actions, /activeCalendar: target\.active \? formData\.get\("activeCalendar"\) === "on" : false/);
  const form = await source("components/UserForm.tsx");
  assert.match(form, /disabled=\{!initial\.active\}/);
  assert.match(form, /genaktivér profilen for at kunne slå kalenderen til/i);
});

// --- Login: values-echo + ?next= tilbage til det dybe link ---

test("login ekkoer brugernavn/'Husk mig' ved fejl og redirecter kun til interne stier", async () => {
  const auth = await source("app/actions/auth.ts");
  assert.match(auth, /const values = \{ username, remember: formData\.get\("remember"\) != null \}/);
  assert.match(auth, /Forkert brugernavn eller adgangskode\.", values/);
  // Verifikationsfund: browsere striber tab/CR/LF ud af URL'er, så "/\t/evil.com"
  // ville blive "//evil.com" — valideringen afviser derfor også kontroltegn.
  assert.match(auth, /next\.startsWith\("\/"\) && !next\.startsWith\("\/\/"\)/);
  assert.match(auth, /x00-\\x20/);
  assert.match(auth, /redirect\(safeNext \? next : "\/calendar"\)/);
  const form = await source("components/LoginForm.tsx");
  assert.match(form, /defaultValue=\{state\.values\?\.username \?\? ""\}/);
  assert.match(form, /defaultChecked=\{state\.values\?\.remember \?\? true\}/);
  assert.match(form, /name="next"/);
});

test("proxy sender den oprindelige sti med som ?next=", async () => {
  const mw = await source("proxy.ts");
  assert.match(mw, /const next = req\.nextUrl\.pathname \+ req\.nextUrl\.search/);
  assert.match(mw, /"\?next=" \+ encodeURIComponent\(next\)/);
  assert.doesNotMatch(mw, /url\.search = "";/);
});

// --- /users/[id]/edit: 404 (aldrig 500) ved ikke-numerisk id ---

test("/users/[id]/edit bruger routeId til id-parsing", async () => {
  const page = await source("app/users/[id]/edit/page.tsx");
  assert.match(page, /import \{ routeId \} from "@\/lib\/route-ids"/);
  assert.match(page, /const userId = routeId\(id\)/);
  assert.doesNotMatch(page, /Number\(id\)/);
});

// --- Catch-all: rigtig 404, ingen intern repo-reference, admin-gate ---

test("ukendte stier giver notFound(), og repo-filreferencen er væk", async () => {
  const page = await source("app/[...slug]/page.tsx");
  assert.match(page, /if \(!meta\) notFound\(\);/);
  assert.doesNotMatch(page, /blueprint\.html|docs\/fenster-blueprint/);
  assert.match(page, /Kun administratorer har adgang til virksomhedens indstillinger\./);
  // Medarbejdersektionerne bygges af databasens rigtige brugere.
  assert.match(page, /\(await getUsers\(false\)\)\.map\(\(u\) => u\.navn\)/);
});

// --- Arbejdstider/Planlægning: rigtige medarbejdere + ærlig status ---

test("buildSettingsPage genererer medarbejdersektioner fra de angivne navne", () => {
  const wh = buildSettingsPage("/working-hours", ["Anne Bruun", "Mika Holm"])!;
  const whText = JSON.stringify(wh);
  assert.ok(whText.includes("Anne Bruun") && whText.includes("Mika Holm"));
  const ps = buildSettingsPage("/planning-settings", ["Anne Bruun"])!;
  assert.ok(JSON.stringify(ps).includes("Anne Bruun"));
  // Tom medarbejderliste håndteres uden at lyve om en hardcodet medarbejder.
  assert.ok(JSON.stringify(buildSettingsPage("/working-hours", [])).includes("Ingen aktive medarbejdere fundet"));
  // Ukendte stier bygger ingenting; andre kendte sider er uændrede.
  assert.equal(buildSettingsPage("/findes-ikke", []), undefined);
  assert.equal(buildSettingsPage("/settings", []), SETTINGS_PAGES["/settings"]);
});

test("de statiske sider hardcoder ikke længere en medarbejder — og siger ærligt, at planlæggeren ikke læser indstillingerne endnu", () => {
  for (const path of ["/working-hours", "/planning-settings"]) {
    const statisk = JSON.stringify(SETTINGS_PAGES[path]);
    assert.ok(!statisk.includes("Kristian Klercke"), `${path} må ikke hardcode en medarbejder`);
    assert.ok(statisk.includes(PLANNER_STATUS_NOTE), `${path} skal vise den ærlige planner-status`);
  }
  assert.match(PLANNER_STATUS_NOTE, /fast arbejdstid man–fre 08:00–16:00 \+ 1 time fleks/);
});

// --- Småting: tastaturbetjenbar variabel-liste + rigtige guide-links ---

test("'Se liste over variable felter' er en rigtig <button>", async () => {
  const comp = await source("components/TemplateEditor.tsx");
  assert.doesNotMatch(comp, /<a onClick/);
  assert.match(comp, /<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setShowVars\(true\)\}/);
});

test("supportsidens hjælpecenter linker til /guides — ikke mailto-attrapper", async () => {
  const page = await source("app/support/page.tsx");
  assert.match(page, /href="\/guides"/);
  assert.match(page, /href="\/guides#planlaegning"/);
  assert.match(page, /href="\/guides#fastpris-og-afslut"/);
  // Kun den ægte kontakt-mailto i tabellen ovenfor må være tilbage.
  assert.equal((page.match(/mailto:/g) ?? []).length, 1);
});
