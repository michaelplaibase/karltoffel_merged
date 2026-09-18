import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("ugekalenderen har et Bemanding-panel indpakket i en week-layout wrapper", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  const css = await source("app/globals.css");

  // Wrapper og scroll-isolation
  assert.match(component, /className="week-layout"/);
  assert.match(component, /className="board-scroll"/);
  assert.match(css, /\.teamcal \.week-layout[\s\S]*display:\s*flex/);
  assert.match(css, /\.teamcal \.board-scroll[\s\S]*overflow-x:\s*auto/);

  // Viser alle medarbejdere fra props.week.employees / week.employees
  assert.match(component, /week\.employees\.map\(\(emp\)/);

  // For hver medarbejder: farvecirkel/initialer, navn og opgavetal
  assert.match(component, /className="staff-ava">\{initials\(emp\.name\)\}<\/span>/);
  assert.match(component, /className="staff-name">\{emp\.name\}<\/span>/);
  assert.match(component, /className="staff-count num">/);
  assert.match(component, /count === 1 \? "opg\." : "opg\."/);

  // Dæmpet visuel stil når emp ikke er i selectedEmp
  assert.match(component, /className=\{`staff-row\$\{isSelected \? "" : " is-off"\}`\}/);
  assert.match(css, /\.teamcal \.staff-row\.is-off[\s\S]*opacity:\s*0\.45/);

  // Klik kalder toggleEmp
  assert.match(component, /onClick=\{\(\) => toggleEmp\(emp\.id\)\}/);

  // Overskrift Bemanding med ugenummer og collapsible toggle
  assert.match(component, /className="staff-title">Bemanding<\/span>/);
  assert.match(component, /Uge \{week\.weekNo\}/);
  assert.match(component, /staff-toggle-btn/);

  // Bund: 'I alt: X opgaver' opsummering
  assert.match(component, /className="staff-foot-label">I alt:<\/span>/);
  assert.match(component, /\{totalEvents === 1 \? "opgave" : "opgaver"\}/);

  // Sammenfoldet bar til at åbne igen
  assert.match(component, /staff-collapsed-bar/);
});
