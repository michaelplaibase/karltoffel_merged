// Struktur-tests for fraværs-featuren (sygdom & ferie) — Thomas, 2026-09-10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

test("schema: Absence-modellen findes med unik (userId, type, date)", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /model Absence \{/);
  assert.match(schema, /@@unique\(\[userId, type, date\]\)/);
  assert.match(schema, /absences\s+Absence\[\]/);
});

test("migration: SQL er idempotent (IF NOT EXISTS / DO-blocks)", () => {
  const sql = read("prisma/migrations/20260910120000_absence/migration.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "Absence"/);
  assert.match(sql, /IF NOT EXISTS/);
  assert.match(sql, /@@|conname/);
});

test("lib/absence: sygdom registreres STRAKS, ferie som pending-ansøgning", () => {
  const lib = read("lib/absence.ts");
  assert.match(lib, /type === "sygdom" \? "registered" : "pending"/);
  // Ferie planlægger KUN efter godkendelse: moveOrdersAwayFrom kaldes ved
  // sygdom-registration og ved approve — aldrig ved pending-registration.
  const registerBlock = lib.slice(lib.indexOf("export async function registerAbsence"), lib.indexOf("export async function approveAbsence"));
  assert.match(registerBlock, /if \(type === "sygdom"\) flyttet = await moveOrdersAwayFrom/);
});

test("lib/absence: flytning rører kun udførelses-klare, ulåste ordrer for den fraværende", () => {
  const lib = read("lib/absence.ts");
  const moveBlock = lib.slice(lib.indexOf("export async function moveOrdersAwayFrom"), lib.indexOf("export type RegisterAbsenceResult"));
  assert.match(moveBlock, /employeeId: userId/);
  assert.match(moveBlock, /lockedFully: false/);
  assert.match(moveBlock, /status: "Afventer levering"/);
  // Undgår andre fraværsdage (flyt aldrig IN på en syge-/feriedag)
  assert.match(moveBlock, /absence\.count/);
});

test("lib/absence: e-mail notifikation ved registrering OG godkendelse", () => {
  const lib = read("lib/absence.ts");
  assert.match(lib, /notifyStaff\(/);
  const approveBlock = lib.slice(lib.indexOf("export async function approveAbsence"), lib.indexOf("export async function rejectAbsence"));
  assert.match(approveBlock, /await notifyStaff/);
  assert.match(lib, /STAFF_NOTIFY_EMAIL/);
});

test("actions: alle mutations er guardede, admin-only hvor de skal være", () => {
  const actions = read("app/actions/absence.ts");
  assert.match(actions, /guardAction|getSessionUser/);
  assert.match(actions, /if \(!me\.isAdmin\) redirect\("\/"\)/);
});

test("siden /fravaer findes og er session-beskyttet", () => {
  const page = read("app/fravaer/page.tsx");
  assert.match(page, /getSessionUser/);
  assert.match(page, /redirect\("\/login"\)/);
});

test("lønrapport: sygedage + feriedage i type, query og side", () => {
  const payroll = read("lib/payroll.ts");
  assert.match(payroll, /sygedage: number/);
  assert.match(payroll, /feriedage: number/);
  assert.match(payroll, /prisma\.absence\.findMany/);
  const page = read("app/payroll/page.tsx");
  assert.match(page, /Sygedage/);
  assert.match(page, /Feriedage/);
});

test("menu: Fravær er synlig for medarbejdere (ingen adminOnly)", () => {
  const nav = read("lib/nav.ts");
  assert.match(nav, /\{ label: "Fravær", en: "Absence", href: "\/fravaer" \}/);
});
