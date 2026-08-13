import assert from "node:assert/strict";
import { createCalendar2Routing, planCalendar2Week, type Calendar2Employee } from "../lib/calendar2-routing";

async function main() {
const fixture = "Grønhøjvej 5, 8700 Horsens";
const home = process.env.CALENDAR2_SMOKE_HOME;
if (!home) throw new Error("Sæt CALENDAR2_SMOKE_HOME til medarbejderens eksisterende hjemmeadresse. Scriptet udfører kun eksterne GET-kald.");

const exact = new URL("https://api.dataforsyningen.dk/adresser");
exact.searchParams.set("q", fixture); exact.searchParams.set("struktur", "mini"); exact.searchParams.set("per_side", "1");
const wash = new URL("https://api.dataforsyningen.dk/datavask/adresser"); wash.searchParams.set("betegnelse", fixture);
const [exactResponse, washResponse] = await Promise.all([fetch(exact), fetch(wash)]);
assert.equal(exactResponse.ok, true); assert.equal(washResponse.ok, true);
const exactBody = await exactResponse.json() as { husnr?:string; postnr?:string; x?:number; y?:number }[];
const washBody = await washResponse.json() as { resultater?: { adresse?:{husnr?:string;postnr?:string} }[] };
assert.equal(exactBody[0]?.husnr,"5"); assert.equal(exactBody[0]?.postnr,"8700");
assert.equal(washBody.resultater?.[0]?.adresse?.husnr,"5"); assert.equal(washBody.resultater?.[0]?.adresse?.postnr,"8700");
assert.ok(Number(exactBody[0]?.y)>=54.4 && Number(exactBody[0]?.y)<=57.9); assert.ok(Number(exactBody[0]?.x)>=7.5 && Number(exactBody[0]?.x)<=15.3);
const routing=createCalendar2Routing(); const route=await routing.buildMatrix([home,fixture]); assert.ok(route.matrix); assert.equal(route.matrix!.provider.startsWith("osrm-table"),true);
const employee:Calendar2Employee={id:1,name:"Smoke",homeAddress:home,workStartMin:480,workEndMin:960,flexMin:60,workdays:[0]};
const plan=planCalendar2Week([{id:1,contactId:1,customer:"Fixture",address:fixture,postal:"8700",category:"Smoke",durationMin:60,source:"fixture-only",fixedEmployeeId:1}],"2026-08-10",[employee],route.matrix!);
assert.equal(plan.unplanned.length,0); assert.equal(plan.days[0].travelLegs[0].kind,"home_to_stop"); assert.equal(plan.days[0].travelLegs.at(-1)?.kind,"return_home");
console.log(JSON.stringify({ exact:{house:"5",postcode:"8700",coordinate:[exactBody[0].y,exactBody[0].x]}, datavask:"exact", matrixProvider:route.matrix!.provider, travelLegs:plan.days[0].travelLegs },null,2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
