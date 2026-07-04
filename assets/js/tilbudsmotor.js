/* ==========================================================================
   Karltoffel Tilbudsmotor (lead flow) — indlejret sektion.
   Uændret logik fra standalone-demoen, men pakket i en IIFE og scopet til
   sektionens rod (#tilbudsmotor), så intet lækker ud i host-sidens globale DOM.
   ========================================================================== */
(function(){
"use strict";

const ROOT = document.getElementById("tilbudsmotor");
if(!ROOT) return;
const $ = (id) => ROOT.querySelector("#" + id);

/* ============ DATA: priser fra WorkMaker Produkter ============ */
/* De prissatte linjer matcher WorkMaker-CSV (04.07.2026). wm = verbatimt
   produktnavn i WorkMaker-CSV (eneste join-nøgle — kun R0–R3 har Varenr),
   inkl. CSV'ens stavefejl: "Tagrenerens 2-plans hus", "Vindeuspudsning
   Indvendig pr glas", "Ukrudt bekæmpelse på belægningsarealer".
   wm = null ⇒ findes endnu ikke i WorkMaker; opret som 0-kr placeholder
   (mønster: "Soignering af bede = 0 kr."): robot, husgarage, stub,
   drivhus, fliserens, sne.
   alge → CSV "Algebehandling af tag"; algeflis → CSV "Algebehandling af
   belægning". beskaering er prissat fra CSV "Beskæring Små træer /
   Frugttræer" (500 kr). pris:null = "Indeholdt" (pakke:true) eller
   "Pris ved besøg" (pakke:false). */
/*PRICING-START*/
const PRODUCTS = [
  /* ---- Villapakken (standard) ---- */
  {id:"vinduer",  navn:"Vinduespudsning udvendig",       enhed:"glas",       pris:15.30, note:"Udvendige ruder",                 qty:14,  freq:6,  fmax:12, on:true,  pakke:true, kat:"pakke", wm:"Vinduespudsning udvendig pr glas"},
  {id:"haek",     navn:"Hækklipning",                    enhed:"m hæk",      pris:27.50, note:"1 side, under 220 cm",            qty:65,  freq:1,  fmax:3,  on:true,  pakke:true, kat:"pakke", wm:"Hækklipning 1 side pr meter Under 220 cm"},
  {id:"green",    navn:"Greenkeeper græspleje",          enhed:"m² plæne",   pris:2.30,  note:"Gødning og pleje af plænen",      qty:450, freq:4,  fmax:6,  on:true,  pakke:true, kat:"pakke", wm:"Greenkeeper græspleje"},
  {id:"alge",     navn:"Algebehandling af tag",          enhed:"m² tag",     pris:4.20,  note:"Mos og alger, beregnet på skråt tagareal", qty:120, freq:1, fmax:2, on:true, pakke:true, kat:"pakke", wm:"Algebehandling af tag"},
  {id:"tagrender",navn:"Tagrenderens",                   enhed:"m tagrende", pris:18.00, note:"Stueplan / 1-plans hus",          qty:24,  freq:1,  fmax:2,  on:true,  pakke:true, kat:"pakke", wm:"Tagrenderens Stueplan / 1-plans hus"},
  {id:"robot",    navn:"Robotplæneklipper service",      enhed:"",           pris:null,  note:"Indeholdt i pakken",              qty:1,   freq:2,  fmax:4,  on:true,  pakke:true, kat:"pakke", wm:null},
  {id:"husgarage",navn:"Vask af hus/garage ned",         enhed:"",           pris:null,  note:"Indeholdt i pakken",              qty:1,   freq:1,  fmax:2,  on:true,  pakke:true, kat:"pakke", wm:null},
  {id:"service",  navn:"Servicering af vinduer og døre", enhed:"",           pris:null,  note:"Indeholdt i pakken",              qty:1,   freq:1,  fmax:2,  on:true,  pakke:true, kat:"pakke", wm:"Service af vinduer og døre"},

  /* ---- Tilvalg: "Vi tilbyder også" (off som standard, gruppe = kat) ---- */
  {id:"ukrudt",    navn:"Ukrudtsbekæmpelse på belægning",         enhed:"m² fliser", pris:1.50,   note:"Vi holder fugerne rene",  qty:60,  freq:5,  fmax:8,  on:false, pakke:false, kat:"groen",   wm:"Ukrudt bekæmpelse på belægningsarealer"},
  {id:"graes",     navn:"Græsslåning",                            enhed:"m² plæne",  pris:1.60,   note:"Klip i sæsonen",          qty:450, freq:16, fmax:26, on:false, pakke:false, kat:"groen",   wm:"Græsslåning"},
  {id:"beskaering",navn:"Beskæring af buske, træer og planter",   enhed:"træer",     pris:500.00, note:"Små træer/frugttræer — større træer efter besøg", qty:3, freq:1, fmax:2, on:false, pakke:false, kat:"groen", prisEnh:"træ", wm:"Beskæring Små træer / Frugttræer"},
  {id:"soignering",navn:"Soignering af bede",                     enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:4,  fmax:12, on:false, pakke:false, kat:"groen",   wm:"Soignering af bede"},
  {id:"stub",      navn:"Stubfræsning",                           enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:1,  on:false, pakke:false, kat:"groen",   wm:null},
  {id:"vinduerind",navn:"Vinduesvask indvendigt",                 enhed:"glas",      pris:19.87,  note:"Indvendige ruder",        qty:14,  freq:1,  fmax:6,  on:false, pakke:false, kat:"vinduer", wm:"Vindeuspudsning Indvendig pr glas"},
  {id:"ovenlys",   navn:"Ovenlysvinduesvask",                     enhed:"stk",       pris:25.00,  note:"Pr. ovenlysvindue",       qty:2,   freq:1,  fmax:4,  on:false, pakke:false, kat:"vinduer", wm:"Ovenlys vinduesvask pr stk"},
  {id:"solcelle",  navn:"Solcellevask",                           enhed:"paneler",   pris:25.00,  note:"Pr. solcellepanel",       qty:0,   freq:1,  fmax:4,  on:false, pakke:false, kat:"vinduer", prisEnh:"panel", wm:"Solcellevask pr solcelle"},
  {id:"drivhus",   navn:"Drivhusvask",                            enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:2,  on:false, pakke:false, kat:"vinduer", wm:null},
  {id:"algeflis",  navn:"Algebehandling af belægning",            enhed:"m² fliser", pris:3.30,   note:"Alger på fliser, terrasse og indkørsel", qty:60, freq:1, fmax:2, on:false, pakke:false, kat:"tag", wm:"Algebehandling af belægning"},
  {id:"fliserens", navn:"Fliserens",                              enhed:"",          pris:null,   note:"Dybderens med maskine — pris ved besøg", qty:1, freq:1, fmax:2, on:false, pakke:false, kat:"tag", wm:null},
  {id:"sedum",     navn:"Gødning af Sedumtag",                    enhed:"m² tag",    pris:21.00,  note:"Pr. m² sedumtag",         qty:0,   freq:1,  fmax:2,  on:false, pakke:false, kat:"tag",     wm:"Gødning af sedumtag"},
  {id:"haveaffald",navn:"Haveaffald (genbrugsafgift)",           enhed:"gang",      pris:600.00, note:"Pr. bortskaffelse",       qty:1,   freq:1,  fmax:6,  on:false, pakke:false, kat:"affald",  wm:"Genbrugsafgift"},
  {id:"sammenriv", navn:"Sammenrivning & bortskaffelse af affald",enhed:"m² plæne",  pris:3.00,   note:"Åbne arealer / plæne",    qty:450, freq:2,  fmax:4,  on:false, pakke:false, kat:"affald",  wm:"Opsamling af løvfald til efteråret Åbne arealer / Græsplæne"},
  {id:"sne",       navn:"Snerydning og saltning",                 enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:20, on:false, pakke:false, kat:"vinter",  wm:null}
];
/* Uberørt kopi til at nulstille pakken når en ny adresse vælges. */
const DEFAULTS = PRODUCTS.map(function(p){ return Object.assign({}, p); });

function beregn(products){
  var aar = 0, count = 0, visits = 0;
  for (var i=0;i<products.length;i++){
    var p = products[i];
    if(!p.on) continue;
    count += 1;                                   /* uprisede ("indeholdt") tæller også med */
    if(p.freq > visits) visits = p.freq;          /* ydelser bundtes på samme besøg */
    if(p.pris != null && p.qty > 0) aar += p.pris * p.qty * p.freq;
  }
  return { aar: aar, md: aar/12, count: count, visits: visits };
}

function linjeMd(p){ return (p.pris == null || !p.qty) ? 0 : (p.pris * p.qty * p.freq) / 12; }
/*PRICING-END*/

const DKK0 = new Intl.NumberFormat("da-DK",{maximumFractionDigits:0});
const DKK2 = new Intl.NumberFormat("da-DK",{minimumFractionDigits:2,maximumFractionDigits:2});
function kr(n){ return DKK0.format(Math.round(n)) + " kr"; }

/* ============ STATE ============ */
const state = {
  adresse: "",
  ejendom: { type:"Villa, 1 fam.", grund:"827 m²", opfoert:"2007", haek:"65 m" }
};

/* ============ ADRESSEOPSLAG: Adressevælgeren (DAWAs officielle afløser) ============ */
const ADR_API = "https://adressevaelger.dk/husnumre/soeg?token=adressevaelger123&maksimum=6&tekst=";
const DEMO_ADR = ["Sundvej 8, 8700 Horsens","Strandkærvej 30, 8700 Horsens","Bygholm Parkvej 1, 8700 Horsens"];
let adrTimer = null;

const adrInput = $("adr-input"), adrList = $("adr-list"), adrNote = $("adr-note");

adrInput.addEventListener("input", ()=>{
  const q = adrInput.value.trim();
  clearTimeout(adrTimer);
  if(q.length < 3){ lukListe(); return; }
  adrTimer = setTimeout(()=>soegAdresse(q), 250);
});

/* Prøver altid live-API'et; fejler kun for netop den forespørgsel (ingen
   permanent låsning til demo-adresser). */
function soegAdresse(q){
  fetch(ADR_API + encodeURIComponent(q))
    .then(r => { if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      adrNote.classList.remove("show");
      const fund = (data && data.fund) ? data.fund : [];
      const hits = fund.filter(f => f.type === "husnummer").map(f => f.titel);
      if(hits.length){ visListe(hits, false); }
      else if(fund.length){ visListe(fund.slice(0,5).map(f => f.titel), true); }
      else { visListe([], true); }
    })
    .catch(()=>{ adrNote.classList.add("show"); visDemoListe(); });
}

function visListe(items, erHint){
  adrList.innerHTML = "";
  items.forEach(t => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = t; b.setAttribute("role","option");
    b.addEventListener("click", ()=> erHint ? fortsaet(t) : vaelgAdresse(t));
    adrList.appendChild(b);
  });
  if(erHint && items.length){
    const h = document.createElement("div");
    h.className = "hint"; h.textContent = "Skriv husnummer med for at ramme din adresse præcist.";
    adrList.appendChild(h);
  }
  if(!items.length){
    const h = document.createElement("div");
    h.className = "hint"; h.textContent = "Ingen match endnu. Skriv lidt mere af adressen.";
    adrList.appendChild(h);
  }
  adrList.classList.add("open");
}

function visDemoListe(){ visListe(DEMO_ADR, false); }
function fortsaet(t){ adrInput.value = t + " "; adrInput.focus(); soegAdresse(adrInput.value.trim()); }
function lukListe(){ adrList.classList.remove("open"); adrList.innerHTML = ""; }

document.addEventListener("click",(e)=>{ if(!e.target.closest(".adr-wrap")) lukListe(); });

/* ============ FLOW ============ */
const DIG_MSGS = ["Graver din matrikel frem...","Måler grunden op...","Kigger på taget fra oven...","Tæller hækmeter...","Regner på det..."];

/* "Nej, prøv igen" cykler gennem skråfotoets 4 optageretninger, så kunden kan
   genkende sin ejendom fra en anden vinkel, før vi sender dem tilbage til
   adressefeltet. Ejendommens data (og dermed prisen) afhænger ikke af fotoet. */
const VERIFY_DIRS = ["north", "east", "south", "west"];
let verifyDir = 0;
const btnNej = $("btn-nej");
const verifyHint = document.createElement("p");
verifyHint.id = "sf-angle-hint";
verifyHint.className = "sf-angle-hint";
verifyHint.setAttribute("role", "status");
verifyHint.setAttribute("aria-live", "polite");
(function(){ const vb = ROOT.querySelector("#step-verify .verify-btns"); if(vb) vb.insertAdjacentElement("afterend", verifyHint); })();
function setVerifyHint(t){ verifyHint.textContent = t || ""; verifyHint.style.display = t ? "block" : "none"; }
setVerifyHint("");

function renderSkraafoto(dir){
  if(window.KARLTOFFEL && window.KARLTOFFEL.skraafotoRender){
    window.KARLTOFFEL.skraafotoRender(state.adresse, dir);
  }
}

/* Auto-mål (nDSM): forudfyld mængderne fra matrikel + bygninger + DHM. */
function applyMeasurements(m){
  if(!m) return;
  state.maal = m;
  const m2 = (v)=> DKK0.format(v) + " m²";
  if(m.grundAreal) state.ejendom.grund = m2(m.grundAreal);
  if(m.haekLangde) state.ejendom.haek = DKK0.format(m.haekLangde) + " m";
  /* Forudfyld kun mængder kunden ikke selv har rettet (touched). */
  const put = (id,v)=>{ if(v>0){ const p = PRODUCTS.find(x=>x.id===id); if(p && !p.touched) p.qty = v; } };
  /* Plænefaktor: haven (grund − bygninger) rummer også indkørsel, terrasse,
     bede og stier. I danske parcelhushaver udgør plænen typisk 60–75 % af
     det åbne areal — vi bruger 70 % som rundt standardtal, afrundet til 10 m². */
  const PLAENE_FAKTOR = 0.70;
  const plaeneAreal = m.haveAreal > 0 ? Math.max(10, Math.round(m.haveAreal * PLAENE_FAKTOR / 10) * 10) : 0;
  put("graes", plaeneAreal); put("green", plaeneAreal); put("sammenriv", plaeneAreal);
  put("haek", m.haekLangde); put("tagrender", m.tagrendeLangde);
  put("alge", m.tagArealSkraat || m.tagAreal);           /* skråt tagareal hvor muligt */
  /* Træantal kan ikke måles — skøn ~1 træ/busk pr. 150 m² have, clamp 2–8. */
  if(m.haveAreal) put("beskaering", Math.min(8, Math.max(2, Math.round(m.haveAreal / 150))));
  /* Højde-baserede pris-tiers ud fra målingen (skifter også WorkMaker-produkt, wm). */
  const haek = PRODUCTS.find(x=>x.id==="haek");
  if(haek && m.haekHojde != null){
    if(m.haekHojde > 2.2){ haek.pris = 38.50; haek.note = "1 side, over 220 cm"; haek.wm = "Hækklipning 1 side pr meter Over 220 cm"; }
    else { haek.pris = 27.50; haek.note = "1 side, under 220 cm"; haek.wm = "Hækklipning 1 side pr meter Under 220 cm"; }
  }
  const tr = PRODUCTS.find(x=>x.id==="tagrender");
  if(tr && m.rygHojde != null){
    if(m.rygHojde > 5){ tr.pris = 28.00; tr.note = "2-plans hus"; tr.wm = "Tagrenerens 2-plans hus"; }
    else { tr.pris = 18.00; tr.note = "Stueplan / 1-plans hus"; tr.wm = "Tagrenderens Stueplan / 1-plans hus"; }
  }
  const hint = ROOT.querySelector(".demo-hint");
  if(hint){
    let t = "Målt automatisk fra matrikel + skråfoto/DHM: grund " + m2(m.grundAreal) + ", have " + m2(m.haveAreal) + (plaeneAreal > 0 ? " (heraf plæne ca. " + m2(plaeneAreal) + ", 70 % af haven)" : "");
    if(m.tagAreal) t += ", tag " + m2(m.tagArealSkraat || m.tagAreal) + (m.taghaeldning ? " (hældn. " + m.taghaeldning + "°)" : "");
    t += ", hæk-omkreds " + DKK0.format(m.haekLangde) + " m" + (m.haekHojde ? " (~" + String(m.haekHojde).replace(".",",") + " m høj)" : "");
    t += ". Mængderne er ca.-tal — ret dem direkte i listen.";
    hint.textContent = t;
  }
  /* Genrender kun hvis kunden ikke er midt i at redigere et mængde-felt (undgå fokus-tab). */
  const active = ROOT.querySelector(".step.active");
  const editing = document.activeElement && document.activeElement.matches && document.activeElement.matches("#rows .qty input");
  if(active && active.id === "step-losning" && !editing) renderTop();
}

let measureReq = 0;
function resetProducts(){
  PRODUCTS.forEach(function(p,i){ Object.assign(p, DEFAULTS[i]); p.touched = false; });
  state.maal = null;
}

function vaelgAdresse(titel){
  state.adresse = titel;
  lukListe();
  adrInput.value = titel;
  resetProducts();                       /* ny adresse → nulstil pakke + mængder */
  verifyDir = 0; setVerifyHint("");
  if(btnNej) btnNej.textContent = "Nej, prøv igen";
  /* Hent skråfoto parallelt med grave-animationen (fejler stille → SVG-fallback). */
  renderSkraafoto(VERIFY_DIRS[0]);
  /* Auto-mål i baggrunden → forudfylder beregneren. Stale-guard: kun nyeste svar bruges. */
  const req = ++measureReq;
  if(window.KARLTOFFEL && window.KARLTOFFEL.measureProperty){
    window.KARLTOFFEL.measureProperty(titel).then(function(m){ if(req === measureReq) applyMeasurements(m); });
  }
  koerGravning(()=> visStep("step-verify"));
}

function koerGravning(done){
  const dig = $("dig"), msg = $("dig-msg"), fill = $("dig-fill");
  $("dig-adr").textContent = state.adresse;
  const reduceret = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduceret){ done(); return; }
  dig.classList.add("on");
  let i = 0;
  msg.textContent = DIG_MSGS[0]; fill.style.width = "12%";
  const t = setInterval(()=>{
    i++;
    if(i < DIG_MSGS.length){
      msg.textContent = DIG_MSGS[i];
      fill.style.width = (12 + i*22) + "%";
    } else {
      clearInterval(t);
      fill.style.width = "100%";
      setTimeout(()=>{ dig.classList.remove("on"); done(); }, 350);
    }
  }, 620);
}

function visStep(id){
  ROOT.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  $("cta-bar").classList.toggle("on", id === "step-losning");
  ROOT.scrollIntoView({ block:"start", behavior:"auto" });
  if(id === "step-verify") $("verify-adr").textContent = state.adresse;
  if(id === "step-losning") renderTop();
  const h = $(id).querySelector("h1,h2");   /* flyt fokus til trinnets overskrift (a11y) */
  if(h){ h.setAttribute("tabindex","-1"); h.focus({ preventScroll:true }); }
}

$("btn-ja").addEventListener("click", ()=> visStep("step-losning"));
btnNej.addEventListener("click", ()=>{
  verifyDir++;
  if(verifyDir < VERIFY_DIRS.length){
    /* Vis samme ejendom fra næste vinkel — bliv på verify-trinnet. */
    renderSkraafoto(VERIFY_DIRS[verifyDir]);
    setVerifyHint("Vi viser din ejendom fra en anden vinkel ("+(verifyDir+1)+" af "+VERIFY_DIRS.length+"). Genkender du den nu?");
    btnNej.textContent = (verifyDir === VERIFY_DIRS.length-1) ? "Nej, skriv adressen igen" : "Nej, vis en anden vinkel";
  } else {
    /* Alle vinkler prøvet → tilbage til adressefeltet. */
    verifyDir = 0; setVerifyHint(""); btnNej.textContent = "Nej, prøv igen";
    adrInput.value = ""; visStep("step-adresse"); adrInput.focus();
  }
});
$("btn-kontakt").addEventListener("click", ()=>{ $("cta-bar").classList.remove("on"); visStep("step-kontakt"); });
$("btn-tilbage").addEventListener("click", ()=> visStep("step-losning"));

$("btn-send").addEventListener("click", ()=>{
  const navn = $("k-navn").value.trim(), mail = $("k-mail").value.trim();
  if(!navn || !mail || mail.indexOf("@") < 1){ $("k-err").classList.add("show"); return; }
  $("k-err").classList.remove("show");
  const r = beregn(PRODUCTS);
  const valgt = PRODUCTS.filter(p=>p.on);
  const opsum = $("tak-opsum");
  if(!valgt.length){
    opsum.innerHTML = "<b>" + esc(state.adresse) + "</b><br>Du har ikke valgt nogen services endnu — vi ringer og sammensætter løsningen med dig.<br><br>Demo: intet er sendt endnu.";
    visStep("step-tak"); return;
  }
  const linjer = valgt.map(p=>{
    const suffix = (p.pris == null) ? (p.pakke ? " (indeholdt)" : " (pris ved besøg)")
                 : (!p.qty ? " (angiv antal)" : " (" + p.freq + "x/år)");
    return esc(p.navn) + suffix;
  }).join(", ");
  opsum.innerHTML =
    "<b>" + esc(state.adresse) + "</b><br>" +
    "Valgt: " + linjer + "<br>" +
    "Estimeret: <b>" + kr(r.md) + "/md</b> ved " + r.visits + " besøg om året.<br><br>" +
    "Demo: intet er sendt endnu. I produktion oprettes lead + tilbud i WorkMaker her.";
  visStep("step-tak");
});

function esc(s){ const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

/* ============ RENDER ============ */
const CAT_ORDER = ["pakke", "groen", "vinduer", "tag", "affald", "vinter"];
const CAT_LABELS = { pakke:"Fra Villapakken", groen:"Grøn have", vinduer:"Vinduer & glas", tag:"Tag & fliser", affald:"Affald", vinter:"Vinter" };
function enhKort(p){ return p.enhed ? p.enhed.split(" ")[0] : "enhed"; }
function prisEnh(p){ return p.prisEnh || enhKort(p); }   /* ental til "kr pr. X" */
function focusById(id){ const el = ROOT.querySelector('input[data-pid="' + id + '"]'); if(el) el.focus(); }

function renderTop(){
  $("t-adr").textContent = state.adresse || "Din adresse";
  $("t-type").textContent = state.ejendom.type;
  $("t-grund").textContent = state.ejendom.grund;
  $("t-opfoert").textContent = state.ejendom.opfoert;
  $("t-haek").textContent = state.ejendom.haek;
  renderLosning();
}

/* Fuld gen-render: rækker (aktive) + tilvalg (inaktive) + priser. */
function renderLosning(){ renderRows(); renderAddons(); opdater(); }

function knap(tegn, label){
  const b = document.createElement("button");
  b.type = "button"; b.textContent = tegn; b.setAttribute("aria-label", label);
  return b;
}

function renderRows(){
  const wrap = $("rows");
  wrap.innerHTML = "";
  PRODUCTS.filter(p => p.on).forEach(p => {
    const priced = (p.pris != null);
    const incl = (p.pakke && !priced);          /* del af Villapakken → "Indeholdt" */
    const row = document.createElement("div");
    row.className = "row" + (priced ? "" : " row--noqty") + (incl ? " row--incl" : "");

    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.checked = true; chk.dataset.pid = p.id;
    chk.setAttribute("aria-label", "Fravælg " + p.navn);
    chk.addEventListener("change", ()=>{ p.on = false; renderLosning(); focusById(p.id); });

    const navn = document.createElement("div");
    navn.className = "navn";
    const sub = priced ? (p.note + " · " + DKK2.format(p.pris) + " kr pr. " + prisEnh(p)) : p.note;
    navn.innerHTML = "<b>" + esc(p.navn) + "</b><small>" + esc(sub) + "</small>";

    row.appendChild(chk); row.appendChild(navn);

    if(priced){
      const qty = document.createElement("div");
      qty.className = "qty";
      const qi = document.createElement("input");
      qi.type = "number"; qi.min = "0"; qi.value = p.qty; qi.inputMode = "numeric"; qi.dataset.qid = p.id;
      qi.setAttribute("aria-label", "Mængde for " + p.navn + " i " + p.enhed);
      qi.addEventListener("input", ()=>{ p.qty = Math.max(0, parseFloat(qi.value) || 0); p.touched = true; opdater(); });
      const ql = document.createElement("span"); ql.textContent = p.enhed;
      qty.appendChild(qi); qty.appendChild(ql);
      row.appendChild(qty);
    }

    const freq = document.createElement("div");
    freq.className = "freq";
    const fv = document.createElement("span"); fv.className = "fv";
    fv.textContent = p.freq + "x pr. år";
    if(priced){
      const minus = knap("−", "Færre besøg med " + p.navn);
      const plus = knap("+", "Flere besøg med " + p.navn);
      function sync(){ fv.textContent = p.freq + "x pr. år"; minus.disabled = p.freq <= 1; plus.disabled = p.freq >= p.fmax; }
      minus.addEventListener("click", ()=>{ if(p.freq > 1){ p.freq--; sync(); opdater(); } });
      plus.addEventListener("click", ()=>{ if(p.freq < p.fmax){ p.freq++; sync(); opdater(); } });
      sync();
      freq.appendChild(minus); freq.appendChild(fv); freq.appendChild(plus);
    } else {
      freq.appendChild(fv);                     /* uprisede: fast frekvens, ingen steppere */
    }
    row.appendChild(freq);

    const pris = document.createElement("div");
    pris.className = "pris"; pris.dataset.id = p.id;
    row.appendChild(pris);

    wrap.appendChild(row);
  });
}

/* "Vi tilbyder også" — inaktive services som kompakte chips, grupperet i kategorier. */
function renderAddons(){
  const wrap = $("addons");
  if(!wrap) return;
  wrap.innerHTML = "";
  CAT_ORDER.forEach(katKey => {
    const items = PRODUCTS.filter(p => !p.on && p.kat === katKey);
    if(!items.length) return;
    const grp = document.createElement("div"); grp.className = "addon-cat-grp";
    const lbl = document.createElement("div"); lbl.className = "addon-cat"; lbl.textContent = CAT_LABELS[katKey];
    const list = document.createElement("div"); list.className = "addon-list";
    items.forEach(p => {
      const chip = document.createElement("label"); chip.className = "addon";
      const chk = document.createElement("input");
      chk.type = "checkbox"; chk.checked = false; chk.dataset.pid = p.id;
      chk.setAttribute("aria-label", "Tilvælg " + p.navn);
      chk.addEventListener("change", ()=>{
        p.on = true; renderLosning();
        const qi = (p.pris != null && !p.qty) ? ROOT.querySelector('#rows input[data-qid="' + p.id + '"]') : null;
        if(qi){ qi.focus(); } else { focusById(p.id); }
      });
      const txt = document.createElement("span");
      const prisTxt = (p.pris == null) ? (p.pakke ? "indgår i pakken" : "pris ved besøg")
                    : (DKK2.format(p.pris) + " kr/" + prisEnh(p));
      txt.innerHTML = "<b>" + esc(p.navn) + "</b><small>" + esc(prisTxt) + "</small>";
      chip.appendChild(chk); chip.appendChild(txt);
      list.appendChild(chip);
    });
    grp.appendChild(lbl); grp.appendChild(list); wrap.appendChild(grp);
  });
}

function opdater(){
  PRODUCTS.forEach(p => {
    const el = ROOT.querySelector('.pris[data-id="' + p.id + '"]');
    if(!el) return;
    el.innerHTML = (p.pris == null)
      ? (p.pakke ? "<b>Indeholdt</b>" : "<b>Pris ved besøg</b>")
      : (!p.qty ? "<b>Angiv antal</b><small>pris følger mængde</small>"
                : "<b>" + kr(p.pris * p.qty) + "</b><small>" + p.freq + (p.freq === 1 ? " gang" : " gange") + " om året</small>");
  });
  const r = beregn(PRODUCTS);
  $("t-count").textContent = r.count;
  $("t-visits").textContent = r.visits;
  $("t-pris").textContent = kr(r.md);
  $("cta-pris").textContent = kr(r.md) + "/md";
  $("cta-detalje").textContent = r.count + " services · " + r.visits + " besøg om året · estimat";
}

})();
