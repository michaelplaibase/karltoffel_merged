/* Verifikation af 'Rundtur i boligen'-redesignet (jsdom). */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync("site/index.html", "utf8");
const js = fs.readFileSync("site/assets/js/tilbudsmotor.js", "utf8");

const dom = new JSDOM(html, {
  url: "https://karltoffel.dk/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;
window.matchMedia = window.matchMedia || (q => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
// skråfoto + auto-mål er eksterne — stub dem
window.KARLTOFFEL = { skraafotoRender(){}, measureProperty(){ return Promise.resolve(null); } };
window.HTMLElement.prototype.scrollIntoView = function(){};
window.Element.prototype.scrollTo = function(){};

window.eval(js);

const doc = window.document;
const ROOT = doc.getElementById("tilbudsmotor");
const $ = id => ROOT.querySelector("#" + id);
let failures = [];
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); if(!cond) failures.push(name); };

// Gå til løsningstrinnet som motoren selv gør (via de rigtige knapper)
$("adr-input").value = "Sundvej 8, 8700 Horsens";
$("adr-videre").click();
doc.getElementById("kt-privat").click();           // valg + auto-videre (koerGravning — reduced motion → direkte)
$("btn-ja").click();

const cards = [...ROOT.querySelectorAll(".tm-card")];
check("3 kort renderet", cards.length === 3);

// (a) alle services i præcis ét kort, ingen tab
const allChk = [...ROOT.querySelectorAll(".tm-card input[type=checkbox]")];
check("19 services renderet i kortene", allChk.length === 19);
const pids = allChk.map(c => c.dataset.pid);
check("alle ids unikke", new Set(pids).size === pids.length);

// (b) ingen rengøring
check("ingen rengøring-service", !pids.some(id => /rengoer|rengor|reng/i.test(id)));

// (c) sticky total == sum
function sum(){ // beregn() er lukket inde; genskab den fra checkbox-tilstand
  return allChk.filter(c=>c.checked).length;
}
// vælg en testkombination: haek (27.50*65) + green (2.30*450) + vinduerind via UI
const chkHaek = ROOT.querySelector('#chk-haek');
chkHaek.checked = true; chkHaek.dispatchEvent(new window.Event("change", {bubbles:true}));
const chkGreen = ROOT.querySelector('#chk-green');
chkGreen.checked = true; chkGreen.dispatchEvent(new window.Event("change", {bubbles:true}));
const chkInd = ROOT.querySelector('#chk-vinduerind');
chkInd.checked = true; chkInd.dispatchEvent(new window.Event("change", {bubbles:true}));
const antal = doc.getElementById("qty-vinduerind");
antal.value = "10"; antal.dispatchEvent(new window.Event("input", {bubbles:true}));

const expected = 27.50*65 + 2.30*450 + 19.87*10;
const stickyTotal = $("tm-sticky-total").textContent;
console.log("  sticky: '" + $("tm-sticky-count").textContent + " · " + stickyTotal + "'");
check("sticky count = 3 ting valgt", $("tm-sticky-count").textContent === "3 ting valgt");
check("sticky total = " + Math.round(expected) + " kr i alt", stickyTotal === Math.round(expected).toLocaleString("da-DK") + " kr i alt");

// (d) antal-felt for vinduer (udvendig): tick + 10 → lægges til summen
const chkUde = ROOT.querySelector('#chk-vinduer');
chkUde.checked = true; chkUde.dispatchEvent(new window.Event("change", {bubbles:true}));
const antalUde = doc.getElementById("qty-vinduer");
antalUde.value = "10"; antalUde.dispatchEvent(new window.Event("input", {bubbles:true}));
const expected2 = expected + 15.30*10;
check("antal-felt (udvendig, 10) rammer summen", $("tm-sticky-total").textContent === Math.round(expected2).toLocaleString("da-DK") + " kr i alt");
check("#bt-total uændret og opdateret", $("bt-total").textContent === Math.round(expected2).toLocaleString("da-DK"));

// (e) expand/collapse
const haven = ROOT.querySelector('.tm-card[data-card="haven"]');
const head = haven.querySelector(".tm-card-head");
check("kort sammenklappet som standard", !haven.classList.contains("open") && head.getAttribute("aria-expanded") === "false");
head.click();
check("klik folder ud (klasse + aria)", haven.classList.contains("open") && head.getAttribute("aria-expanded") === "true");
const ude = ROOT.querySelector('.tm-card[data-card="ude"]');
ude.querySelector(".tm-card-head").click();
check("flere kort kan være åbne", haven.classList.contains("open") && ude.classList.contains("open"));
head.click();
check("klik folder sammen igen", !haven.classList.contains("open") && head.getAttribute("aria-expanded") === "false");
check("GTM event skubbet (non-breaking)", window.dataLayer.some(e => e.event === "tm_card_expand" && e.tm_card === "ude"));

// rækkefordeling pr. kort
const map = {};
cards.forEach(c => {
  const k = c.dataset.card;
  map[k] = [...c.querySelectorAll("input[type=checkbox]")].map(x => x.dataset.pid);
});
console.log("  Kortfordeling:", JSON.stringify(map, null, 2));

// lead-payload struktur (services + estimat) — simuler ikke netværk, men tjek at beregn-udgangen bruges
check("sticky-bar ligger under listen og over tm-nav",
  (() => { const s = doc.getElementById("step-losning");
    const rows = s.querySelector(".rows"), sticky = s.querySelector(".tm-sticky"), nav = s.querySelector(".tm-nav");
    return !!(rows && sticky && nav && rows.compareDocumentPosition(sticky) & 4 && sticky.compareDocumentPosition(nav) & 4); })());

console.log(failures.length ? "\nFAILURES: " + failures.join("; ") : "\nALLE TJEK BESTÅET");
process.exit(failures.length ? 1 : 0);
