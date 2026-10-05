import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const motor = await read("site/assets/js/tilbudsmotor.js");
const side = await read("site/src/sider/c/det-vi-ordner/graespleje/tail.html");
const route = await read("app/api/leads/route.ts");
const json = JSON.parse(await read("site/src/data/ydelser.json"));

assert.ok(motor.includes('{id:"green",    navn:"Greenkeeper græspleje",          enhed:"m² plæne",   pris:4.00, min:699'));
assert.ok(side.includes("Math.max(4*f.m2,699)"));
assert.ok(side.includes("pris:4,min:699"));
assert.ok(side.includes("Mindstepris 699 kr."));
assert.ok(route.includes('min: typeof s.min === "number" && Number.isFinite(s.min) && s.min >= 0 ? Math.min(s.min, 1_000_000) : null'));
assert.equal(json.find((service) => service.slug === "graespleje")?.pris, "699");

const context = { window: { KARLTOFFEL: {} } };
vm.createContext(context);
const config = side.match(/window\.KARLTOFFEL\.ydelsePris = (\{[^\n]+\});/);
assert.ok(config, "price config JSON found");
const obj = JSON.parse(config[1]);
const env = { f: { m2: 100 }, Math };
assert.equal(vm.runInNewContext(obj.prisFn, env), 699);
env.f.m2 = 200;
assert.equal(vm.runInNewContext(obj.prisFn, env), 800);
assert.equal(vm.runInNewContext(obj.servicesFn, env)[0].min, 699);
console.log("Greenkeeper pricing smoke passed: 100 m² → 699 kr; 200 m² → 800 kr; lead minimum passed through.");
