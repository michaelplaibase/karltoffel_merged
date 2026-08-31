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
   wm = null ⇒ findes endnu ikke i WorkMaker; opret som 0-kr placeholder:
   drivhus, fliserens.
   alge → CSV "Algebehandling af tag"; algeflis → CSV "Algebehandling af
   belægning". beskaering er prissat fra CSV "Beskæring Små træer /
   Frugttræer" (500 kr). pris:null = "Indeholdt" (pakke:true) eller
   "Pris ved besøg" (pakke:false). */
/*PRICING-START*/
const PRODUCTS = [
  /* ---- Villapakken (ikke forudvalgt — kunden vælger selv) ---- */
  {id:"vinduer",  navn:"Udvendig vinduesvask",       enhed:"glas",       pris:15.30, note:"Udvendige døre, vinduer og porte",                 qty:0,   freq:8,  fmax:12, on:false, pakke:true, kat:"pakke", wm:"Udvendig vinduesvask pr glas"},
  {id:"haek",     navn:"Hækklipning",                    enhed:"m hæk",      pris:27.50, note:"1 side, under 220 cm",            qty:65,  freq:1,  fmax:3,  on:false, pakke:true, kat:"pakke", wm:"Hækklipning 1 side pr meter Under 220 cm"},
  {id:"green",    navn:"Greenkeeper græspleje",          enhed:"m² plæne",   pris:2.30,  note:"Gødning og pleje af plænen",      qty:450, freq:3,  fmax:6,  on:false, pakke:true, kat:"pakke", wm:"Greenkeeper græspleje"},
  {id:"alge",     navn:"Algebehandling af tag",          enhed:"m² tag",     pris:4.20,  note:"Mos og alger, beregnet på skråt tagareal", qty:120, freq:1, fmax:2, on:false, pakke:true, kat:"pakke", wm:"Algebehandling af tag"},
  {id:"tagrender",navn:"Tagrenderens",                   enhed:"m tagrende", pris:18.00, note:"Stueplan / 1-plans hus",          qty:24,  freq:1,  fmax:2,  on:false, pakke:true, kat:"pakke", wm:"Tagrenderens Stueplan / 1-plans hus"},

  /* ---- Tilvalg: "Vi tilbyder også" (off som standard, gruppe = kat) ---- */
  {id:"ukrudt_sproejt", navn:"Sprøjtning af ukrudt mellem belægning", enhed:"m² fliser", pris:1.50, note:"Vi holder fugerne rene", qty:60, freq:5, fmax:8, on:false, pakke:false, kat:"groen", wm:"Ukrudt bekæmpelse på belægningsarealer"},
  {id:"ukrudt_fjern", navn:"Fjernelse af ukrudt mellem belægning", enhed:"m² fliser", pris:4.00, note:"Manuel fjernelse af ukrudt", qty:60, freq:5, fmax:8, on:false, pakke:false, kat:"groen", wm:null},
  {id:"graes",     navn:"Græsslåning",                            enhed:"m² plæne",  pris:1.60,   note:"Klip i sæsonen",          qty:450, freq:1,  fmax:26, on:false, pakke:false, kat:"groen",   wm:"Græsslåning"},
  {id:"beskaering",navn:"Beskæring af buske, træer og planter",   enhed:"træer",     pris:500.00, note:"Små træer/frugttræer — større træer efter besøg", qty:3, freq:1, fmax:2, on:false, pakke:false, kat:"groen", prisEnh:"træ", wm:"Beskæring Små træer / Frugttræer"},
  {id:"vinduerind",navn:"Indendørs vinduespudsning",              enhed:"glas",      pris:19.87,  note:"Indvendige døre, vinduer og porte", qty:0,   freq:1,  fmax:6,  on:false, pakke:false, kat:"vinduer", wm:"Indendørs vinduespudsning pr glas"},
  {id:"solcelle",  navn:"Solcellevask",                           enhed:"paneler",   pris:40.00,  note:"Solcellepaneler på taget",          qty:0,   freq:1,  fmax:4,  on:false, pakke:false, kat:"vinduer", prisEnh:"panel", wm:"Solcellevask pr panel"},
  {id:"drivhus",   navn:"Drivhusvask",                            enhed:"gang",      pris:100.00, note:"Fast pris pr. gang — så er drivhuset vasket", qty:1, freq:1,  fmax:2,  on:false, pakke:false, kat:"vinduer", wm:"Drivhusvask — fast pris pr. gang"},
  {id:"algeflis",  navn:"Algebehandling af belægning",            enhed:"m² fliser", pris:3.30,   note:"Alger på fliser, terrasse og indkørsel", qty:60, freq:1, fmax:2, on:false, pakke:false, kat:"tag", wm:"Algebehandling af belægning"},
  {id:"fliserens", navn:"Fliserens",                              enhed:"",          pris:null,   note:"Dybderens med maskine — pris ved besøg", qty:1, freq:1, fmax:2, on:false, pakke:false, kat:"tag", wm:null},
  {id:"sammenriv", navn:"Sammenrivning & bortskaffelse af affald",enhed:"m² plæne",  pris:3.00,   note:"Åbne arealer / plæne",    qty:450, freq:1,  fmax:4,  on:false, pakke:false, kat:"affald",  wm:"Opsamling af løvfald til efteråret Åbne arealer / Græsplæne"},

  /* ---- Skadedyr ---- */
  {id:"myre_ude",   navn:"Myrebekæmpelse, udvendig sokkelbehandling", enhed:"gang", pris:935.00,  note:"Standard parcelhus",              qty:1, freq:1, fmax:2, on:false, pakke:false, kat:"skadedyr", wm:"Myrebekæmpelse udvendig sokkelbehandling"},
  {id:"myre_inde",  navn:"Myrebekæmpelse, indvendig behandling",      enhed:"gang", pris:650.00,  note:"Standard parcelhus",              qty:1, freq:1, fmax:2, on:false, pakke:false, kat:"skadedyr", wm:"Myrebekæmpelse indvendig behandling"},
  {id:"myre_saeson",navn:"Myrebekæmpelse, sæsonpakke",                enhed:"gang", pris:2650.00, note:"3x udvendig behandling i sæsonen", qty:1, freq:1, fmax:1, on:false, pakke:false, kat:"skadedyr", wm:"Myrebekæmpelse sæsonpakke 3x udvendig"}
];
/* Uberørt kopi til at nulstille pakken når en ny adresse vælges. */
const DEFAULTS = PRODUCTS.map(function(p){ return Object.assign({}, p); });

/* Prisen er bare en sum: hver valgt service lægges til, og det er det.
   Ingen regning pr. besøg, ingen snit — det tal kunderne spurgte til. */
function beregn(products){
  var total = 0, count = 0;
  for (var i=0;i<products.length;i++){
    var p = products[i];
    if(!p.on) continue;
    count += 1;                                   /* uprisede ("indeholdt") tæller også med */
    if(p.pris != null && p.qty > 0) total += p.pris * p.qty;
  }
  return { total: total, count: count };
}
/*PRICING-END*/

const DKK0 = new Intl.NumberFormat("da-DK",{maximumFractionDigits:0});
const DKK2 = new Intl.NumberFormat("da-DK",{minimumFractionDigits:2,maximumFractionDigits:2});
function kr(n){ return DKK0.format(Math.round(n)) + " kr"; }

/* Blød count-op/ned af viste tal (~450 ms, ease-out cubic, requestAnimationFrame).
   Bruges overalt hvor kr()-tal skrives, så priser/rabatter tæller fra gammel til
   ny værdi. Respekterer prefers-reduced-motion: så sættes slutværdien straks. */
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
function animateNumber(el, from, to, fmt){
  if(!el) return;
  fmt = fmt || kr;
  if(REDUCE_MOTION.matches || !isFinite(from) || from === to){ el.textContent = fmt(to); return; }
  if(el._tmRaf) cancelAnimationFrame(el._tmRaf);
  const t0 = performance.now(), DUR = 450;
  function frame(now){
    const t = Math.min(1, (now - t0) / DUR);
    const e = 1 - Math.pow(1 - t, 3);          /* ease-out cubic */
    el.textContent = fmt(from + (to - from) * e);
    el._tmRaf = t < 1 ? requestAnimationFrame(frame) : 0;
  }
  el._tmRaf = requestAnimationFrame(frame);
}

/* ============ STATE ============ */
const state = {
  adresse: "",
  kundetype: null,   /* "privat" | "erhverv" — vælges på step 2 */
  betaling: "pr_gang",   /* fast: betaling pr. gang — abonnements-valg fjernet */
  rabatkode: { code:"", percent:0, valid:false },   /* valideret server-side via /api/rabatkode */
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
  /* Opdater priserne på stedet (ingen gen-render), så priserne tæller
     blødt hen til de auto-målte mængder. */
  const active = ROOT.querySelector(".step.active");
  if(active && active.id === "step-losning") opdater();
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
  /* Videre til privat/erhverv-valget; gravningen kører først ved "Videre" derfra
     (skråfoto + auto-mål er allerede sat i gang i baggrunden ovenfor). */
  visStep("step-kundetype");
}

function koerGravning(done){
  const dig = $("dig"), msg = $("dig-msg"), fill = $("dig-fill");
  $("dig-adr").textContent = state.adresse;
  const reduceret = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduceret){ done(); return; }
  ROOT.classList.add("digging");   /* min-height-garanti: overlayet skal have plads på korte trin */
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
      setTimeout(()=>{ dig.classList.remove("on"); ROOT.classList.remove("digging"); done(); }, 350);
    }
  }, 620);
}

const STEP_ORDER = ["step-adresse","step-kundetype","step-verify","step-losning","step-kontakt"];

/* skipScroll: ved stille gendannelse (persistens) må siden ikke hoppe til
   sektionen eller stjæle fokus — kunden er måske landet øverst på forsiden. */
function visStep(id, skipScroll){
  ROOT.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  if(!skipScroll) ROOT.scrollIntoView({ block:"start", behavior:"auto" });
  if(id === "step-verify") $("verify-adr").textContent = state.adresse;
  if(id === "step-losning") renderTop();
  /* Fremdrift: "Trin N af 5" + dots (skjules på tak-trinnet). */
  const prog = $("tm-progress");
  if(prog){
    const idx = STEP_ORDER.indexOf(id);
    prog.classList.toggle("done", idx === -1);
    if(idx > -1){
      $("tm-progress-txt").textContent = "Trin " + (idx+1) + " af " + STEP_ORDER.length;
      const dots = $("tm-progress-dots").children;
      for(let i=0;i<dots.length;i++) dots[i].classList.toggle("on", i <= idx);
    }
  }
  if(!skipScroll){
    const h = $(id).querySelector("h1,h2");   /* flyt fokus til trinnets overskrift (a11y) */
    if(h){ h.setAttribute("tabindex","-1"); h.focus({ preventScroll:true }); }
  }
  gemState(id);
}

/* ============ PERSISTENS: flowet overlever refresh (mobil!) ============ */
/* sessionStorage (ikke localStorage): dør med fanen, ingen cookie-samtykke-
   problematik. 1 times udløb. Fejler stille i private-mode. */
const PERSIST_KEY = "tm-state-v1";
function gemState(stepId){
  try {
    if(!state.adresse) return;
    const prod = {};
    PRODUCTS.forEach(p => { prod[p.id] = { on: p.on, qty: p.qty, freq: p.freq, touched: !!p.touched }; });
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify({
      t: Date.now(), adresse: state.adresse, kundetype: state.kundetype, betaling: state.betaling, step: stepId, prod,
      rabatkode: state.rabatkode
    }));
  } catch(e){ /* private mode / kvote — persistens er best-effort */ }
}
function rydState(){ try { sessionStorage.removeItem(PERSIST_KEY); } catch(e){} }

/* ============ KUNDETYPE (privat/erhverv) ============ */
/* Sitedækkende præference — samme localStorage-nøgle som kundetype.js
   (forside-modal + header-switch), så valget følger kunden begge veje. */
const KUNDETYPE_KEY = "kt-kundetype-v1";
const ktPrivat = $("kt-privat"), ktErhverv = $("kt-erhverv"),
      ktVidere = $("kt-videre"), ktNote = $("kt-note"), ktCvrWrap = $("k-cvr-wrap");
function vaelgKundetype(t){
  state.kundetype = t;
  ktPrivat.classList.toggle("selected", t === "privat");
  ktErhverv.classList.toggle("selected", t === "erhverv");
  ktPrivat.setAttribute("aria-checked", t === "privat" ? "true" : "false");
  ktErhverv.setAttribute("aria-checked", t === "erhverv" ? "true" : "false");
  ktNote.classList.toggle("show", t === "erhverv");
  if(ktCvrWrap) ktCvrWrap.hidden = (t !== "erhverv");
  ktVidere.disabled = false;
  /* Spejl valget til den sitedækkende præference (to-vejs-synk med
     kundetype.js). Best-effort — private mode må aldrig vælte flowet. */
  try { localStorage.setItem(KUNDETYPE_KEY, t); } catch(e){}
}
/* Kortklik vælger OG fortsætter (ét klik i stedet for to). Kort pause så
   valget når at blive synligt; "Videre" står tilbage som tastatur-fallback.
   Race-guards: "Tilbage" i pause-vinduet annullerer timeren, og ktFortsaet
   kører kun mens kundetype-trinnet faktisk er aktivt (dækker også
   prefers-reduced-motion, hvor graveanimationen springes over). */
let ktGaar = false, ktTimer = null;
function ktFortsaet(){
  if(ktGaar) return;
  const aktiv = ROOT.querySelector(".step.active");
  if(!aktiv || aktiv.id !== "step-kundetype") return;
  ktGaar = true;
  koerGravning(()=>{ ktGaar = false; visStep("step-verify"); });
}
function ktKlik(t){ vaelgKundetype(t); if(!ktGaar){ clearTimeout(ktTimer); ktTimer = setTimeout(ktFortsaet, 180); } }
ktPrivat.addEventListener("click", ()=> ktKlik("privat"));
ktErhverv.addEventListener("click", ()=> ktKlik("erhverv"));
ktVidere.addEventListener("click", ()=>{ if(state.kundetype) ktFortsaet(); });
$("kt-tilbage").addEventListener("click", ()=>{ clearTimeout(ktTimer); visStep("step-adresse"); });

/* ============ BETALING — én samlet pris ============ */
const btTotal = $("bt-total"), lsVidere = $("ls-videre");
function vaelgBetaling(t){
  state.betaling = t;
  lsVidere.disabled = false;
}

/* Pris-tekst på betalingskortet: summen af de valgte services, intet andet. */
function opdaterBetaling(){
  if(!btTotal) return;
  const r = beregn(PRODUCTS);
  btTotal.textContent = DKK0.format(Math.round(r.total));
}

/* ============ VIDERE/TILBAGE-NAVIGATION ============ */
/* Step 1: "Videre" kræver en adresse. Er der tekst i feltet, men intet valg
   fra listen, bruger vi det indtastede som adresse (API'et kan være nede). */
$("adr-videre").addEventListener("click", ()=>{
  const q = adrInput.value.trim();
  if(state.adresse && q === state.adresse){ visStep("step-kundetype"); return; }
  if(q.length >= 3){ vaelgAdresse(q); return; }
  adrInput.focus();
});
$("vf-tilbage").addEventListener("click", ()=> visStep("step-kundetype"));
$("ls-tilbage").addEventListener("click", ()=> visStep("step-verify"));
$("ls-videre").addEventListener("click", ()=>{ if(state.betaling) visStep("step-kontakt"); });
/* "Skift adresse" på løsnings-trinnet: start flowet forfra på adresse-trinnet.
   resetProducts() kører automatisk, når en ny adresse vælges (vaelgAdresse). */
$("ls-skift").addEventListener("click", ()=>{
  adrInput.value = "";
  lukListe();
  visStep("step-adresse");
  adrInput.focus();
});

$("btn-ja").addEventListener("click", ()=>{ visStep("step-losning"); });
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
$("btn-tilbage").addEventListener("click", ()=> visStep("step-losning"));

/* ============ RABATKODE (valgfri, kontakt-trinnet) ============ */
/* Valideres server-side via sitets read-only relay (/api/rabatkode?code=X →
   {valid, percent}). Valid kode = EKSTRA procent-rabat oven i mængderabatten.
   Må ALDRIG blokere indsendelsen: fejl/ukendt kode ⇒ ingen rabat, flowet
   fortsætter. Stale-guard: kun svaret på den nyeste indtastning bruges. */
const rkInput = $("k-rabat"), rkStatus = $("k-rabat-status");
let rkReq = 0;
function rkNote(cls, html){
  if(!rkStatus) return;
  rkStatus.className = "rk-note " + cls;
  rkStatus.innerHTML = html;
  rkStatus.hidden = false;
}
function tjekRabatkode(){
  if(!rkInput) return;
  const kode = rkInput.value.trim().toUpperCase();
  const req = ++rkReq;
  if(!kode){
    state.rabatkode = { code:"", percent:0, valid:false };
    if(rkStatus){ rkStatus.hidden = true; rkStatus.textContent = ""; }
    opdaterRabat();
    gemState("step-kontakt");
    return;
  }
  fetch("/api/rabatkode?code=" + encodeURIComponent(kode))
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if(req !== rkReq) return;   /* forældet svar — brugeren har rettet koden */
      const pct = (d && d.valid === true) ? Math.max(0, Math.min(100, Number(d.percent) || 0)) : 0;
      if(pct > 0){
        state.rabatkode = { code: kode, percent: pct, valid: true };
        rkNote("rk-ok", 'Rabatkode anvendt: <b>−<span class="rk-pct tm-anim-kr">0</span>%</b>');
        animateNumber(rkStatus && rkStatus.querySelector(".rk-pct"), 0, pct,
          function(n){ return DKK0.format(Math.round(n)); });
      } else {
        state.rabatkode = { code: kode, percent: 0, valid: false };
        rkNote("rk-ukendt", "Ukendt rabatkode");
      }
      /* Vis koden i løsnings-trinnets rabat-banner + husk den over refresh. */
      opdaterRabat();
      gemState("step-kontakt");
    })
    .catch(()=>{
      if(req !== rkReq) return;
      state.rabatkode = { code: kode, percent: 0, valid: false };
      rkNote("rk-ukendt", "Ukendt rabatkode");
      opdaterRabat();
      gemState("step-kontakt");
    });
}
if(rkInput){
  rkInput.addEventListener("blur", tjekRabatkode);
  rkInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); tjekRabatkode(); } });
}

/* ============ CVR-OPSLAG (erhverv, kontakt-trinnet) ============ */
/* Slås op server-side via sitets read-only relay (/api/cvr?cvr=XXXXXXXX →
   { found, name?, address?, zipcode?, city?, reason? }). Udfylder firmanavn
   + firmaadresse automatisk, men felterne forbliver fuldt redigerbare — et
   forkert/ukendt CVR eller et nede CVR-API må ALDRIG blokere indsendelsen;
   kunden taster bare oplysningerne manuelt. Auto-opslag ved 8 cifre, plus
   blur/Enter som fallback (samme mønster som rabatkoden). Stale-guard: kun
   svaret på det nyeste opslag bruges. */
const cvrInput = $("k-cvr"), cvrStatus = $("k-cvr-status"),
      firmaInput = $("k-firma"), firmaAdrInput = $("k-firma-adr");
let cvrReq = 0;
function cvrNote(cls, tekst){
  if(!cvrStatus) return;
  cvrStatus.className = "rk-note " + cls;
  cvrStatus.textContent = tekst;
  cvrStatus.hidden = false;
}
function tjekCvr(){
  if(!cvrInput) return;
  const cvr = cvrInput.value.replace(/\D/g,"");
  const req = ++cvrReq;
  if(cvr.length !== 8){
    if(cvrStatus){ cvrStatus.hidden = true; cvrStatus.textContent = ""; }
    if(cvr) cvrNote("rk-ukendt", "CVR skal være 8 cifre");
    return;
  }
  cvrNote("rk-ok", "Slår CVR op…");
  fetch("/api/cvr?cvr=" + encodeURIComponent(cvr))
    .then(r => r.ok ? r.json() : (r.status === 400 ? r.json() : { found:false, reason:"unavailable" }))
    .then(d => {
      if(req !== cvrReq) return;   /* forældet svar — brugeren har rettet CVR-nummeret */
      if(d && d.found){
        if(firmaInput && !firmaInput.value.trim()) firmaInput.value = d.name || "";
        if(firmaAdrInput && !firmaAdrInput.value.trim()){
          const adr = [d.address, [d.zipcode, d.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
          firmaAdrInput.value = adr;
        }
        cvrNote("rk-ok", "Fundet: " + (d.name || ""));
      } else if(d && d.reason === "not_found"){
        cvrNote("rk-ukendt", "CVR ikke fundet — udfyld firmaoplysninger manuelt");
      } else {
        /* API nede/kvote/timeout/ugyldigt format — degrader roligt, flowet fortsætter uændret. */
        cvrNote("rk-ukendt", "CVR-opslag ikke tilgængeligt lige nu — udfyld manuelt");
      }
    })
    .catch(()=>{
      if(req !== cvrReq) return;
      cvrNote("rk-ukendt", "CVR-opslag ikke tilgængeligt lige nu — udfyld manuelt");
    });
}
if(cvrInput){
  cvrInput.addEventListener("input", ()=>{
    cvrInput.value = cvrInput.value.replace(/\D/g,"").slice(0,8);
    if(cvrInput.value.length === 8) tjekCvr();
  });
  cvrInput.addEventListener("blur", tjekCvr);
  cvrInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); tjekCvr(); } });
}

$("btn-send").addEventListener("click", ()=>{
  const navn = $("k-navn").value.trim(), mail = $("k-mail").value.trim(), tlf = $("k-tlf").value.trim();
  /* Telefon er obligatorisk — hele løftet er et opkald. E-mail er valgfri,
     men skal ligne en e-mail, hvis den er udfyldt. */
  if(!navn || tlf.replace(/\D/g,"").length < 8){ sendFejl("Udfyld navn og telefonnummer, så vi kan ringe dig op."); return; }
  if(mail && mail.indexOf("@") < 1){ sendFejl("Tjek lige e-mailen — den ser ikke rigtig ud."); return; }
  $("k-err").classList.remove("show");

  const r = beregn(PRODUCTS);
  const valgt = PRODUCTS.filter(p=>p.on);
  const ktLabel = state.kundetype === "erhverv" ? " · Erhverv" : (state.kundetype === "privat" ? " · Privat" : "");
  /* Rabatkode: ekstra procentrabat, trukket fra den samlede sum. */
  const kodePct = state.rabatkode.valid ? state.rabatkode.percent : 0;
  const totalNet = r.total * (1 - kodePct/100);

  /* Lead-payload til CRM'et: kontaktinfo + valgte services (med WorkMaker-
     nøgle under overgangen) + estimat + kundetype. Sendes via sitets relay
     (/api/lead) — secret'en bor på serveren, aldrig i browseren. */
  const payload = {
    name: navn, email: mail, phone: tlf,
    message: $("k-note").value.trim().slice(0, 2000),   /* server-cap er 2000 — klip lokalt så relayets 9 KB-grænse aldrig rammes */
    address: state.adresse,
    kundetype: state.kundetype,
    betaling: state.betaling,
    source: "tilbudsmotor",
    services: valgt.map(p=>({ id:p.id, navn:p.navn, wm:p.wm, qty:p.qty, enhed:p.enhed, freq:p.freq, pris:p.pris, erPakkevare:p.pakke })),
    estimat: { total: Math.round(totalNet), count: r.count }
  };
  /* KONTRAKT: feltnavn `rabatkode` (streng, trimmet + uppercased) — kun med når koden er valid. */
  if(state.rabatkode.valid) payload.rabatkode = state.rabatkode.code;
  /* Erhverv: CVR + firmaoplysninger er valgfrie ekstra felter på leadet —
     blot informative for CRM'et, blokerer aldrig indsendelsen (se tjekCvr). */
  if(state.kundetype === "erhverv"){
    const cvrVal = cvrInput ? cvrInput.value.replace(/\D/g,"") : "";
    const firmaVal = firmaInput ? firmaInput.value.trim() : "";
    const firmaAdrVal = firmaAdrInput ? firmaAdrInput.value.trim() : "";
    if(cvrVal) payload.cvr = cvrVal;
    if(firmaVal) payload.firma = firmaVal;
    if(firmaAdrVal) payload.firmaAdresse = firmaAdrVal;
  }
  /* Hvilken pakke kunden kom ind fra (sat som cookie af pakker-priser-siden,
     samme cookie som den gamle Bubble-formular bruger — se script.js). Ryddes
     efter brug så et evt. senere besøg uden pakke-klik ikke arver den. */
  if(typeof Cookies !== "undefined"){
    const valgtPakke = Cookies.get("selected_package");
    if(valgtPakke){ payload.pakke = valgtPakke; Cookies.remove("selected_package", {path:"/"}); }
  }

  const btnSend = $("btn-send");
  btnSend.disabled = true;
  const btnTekst = btnSend.textContent;
  btnSend.textContent = "Sender...";

  fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => { if(!res.ok) throw new Error("HTTP " + res.status); return res.json().catch(()=>({})); })   /* 2xx med u-parsbar body: leadet ER oprettet — vis tak-siden */
  .then((data)=>{
    /* Leadet er oprettet — send konverteringen til GTM først, så den ikke kan
       gå tabt hvis noget i tak-siden nedenfor fejler. */
    pushLeadEvent(valgt, r, totalNet, kodePct);

    /* CRM'et returnerer call:"booked 2026-07-06T15:15:00" når opkalds-slottet
       er lagt i kalenderen — vis det konkrete tidspunkt til kunden. */
    const ring = $("tak-ring");
    if(ring){
      const t = ringTekst(data && data.call);
      ring.textContent = t;
      ring.classList.toggle("show", !!t);
    }
    const opsum = $("tak-opsum");
    if(!valgt.length){
      opsum.innerHTML = "<b>" + esc(state.adresse) + ktLabel + "</b><br>Du har ikke valgt nogen services endnu — vi ringer og sammensætter løsningen med dig.";
    } else {
      const linjer = valgt.map(p=>{
        const suffix = (p.pris == null) ? (p.pakke ? " (indeholdt)" : " (pris ved besøg)")
                     : (!p.qty ? " (angiv antal)" : " (" + p.freq + "x/år)");
        return esc(p.navn) + suffix;
      }).join(", ");
      var kodeLinje = kodePct > 0 ? "Rabatkode anvendt: <b>−" + kodePct + "%</b><br>" : "";
      opsum.innerHTML =
        "<b>" + esc(state.adresse) + ktLabel + "</b><br>" +
        "Valgt: " + linjer + "<br>" +
        kodeLinje +
        'Samlet pris: <b><span id="tak-total" class="tm-anim-kr">' + kr(totalNet) + '</span></b>';
      /* Tak-totalerne tæller blødt op fra 0 (count-animationen). */
      animateNumber(opsum.querySelector("#tak-total"), 0, totalNet, kr);
    }
    rydState();   /* leadet er sendt — intet at gendanne længere */
    visStep("step-tak");
  })
  .catch(()=>{
    sendFejl("Vi kunne ikke sende din forespørgsel lige nu. Prøv igen om et øjeblik — eller ring til os.");
  })
  .finally(()=>{ btnSend.disabled = false; btnSend.textContent = btnTekst; });
});

function sendFejl(t){ const e = $("k-err"); e.textContent = t; e.classList.add("show"); }

/* ============ Konvertering til Google Tag Manager ============ */
/* Skubber GA4-eventet `generate_lead` i dataLayer — kun når CRM'et har
   bekræftet leadet, så mislykkede forsøg ikke tælles som konverteringer.

   INGEN PERSONDATA: navn, e-mail, telefon, adresse og fritekst holdes bevidst
   ude af dataLayer, så GTM/GA4 aldrig får PII. Kun beløb, antal og hvilke
   services der er valgt.

   `value` er den estimerede ÅRLIGE omsætning netto — efter mængderabat og
   rabatkode. Måned/år/brutto ligger med som separate felter, så GTM selv kan
   vælge hvad der skal bruges som konverteringsværdi.

   `items` følger GA4's semantik: `price` = enhedspris, `quantity` = antal
   enheder (glas, m², træer) — altså den samlede værdi. Linjeværdien ligger
   eksplicit i `item_revenue`. Uprisede linjer ("indeholdt" / "pris ved besøg")
   sendes med pris 0, men tæller i `lead_services_count`. */
function pushLeadEvent(valgt, r, totalNet, kodePct){
  const dl = (window.dataLayer = window.dataLayer || []);
  const ev = {
    event: "generate_lead",
    currency: "DKK",
    value: Math.round(totalNet),
    lead_source: "tilbudsmotor",
    lead_kundetype: state.kundetype || "ukendt",
    lead_services_count: r.count,
    lead_value_total: Math.round(totalNet),
    lead_coupon_discount_pct: kodePct,
    items: valgt.map(function(p, i){
      const enhedspris = p.pris == null ? 0 : p.pris;
      return {
        item_id: p.id,
        item_name: p.navn,
        item_category: p.kat,
        item_list_name: p.pakke ? "Villapakken" : "Tilvalg",
        index: i,
        price: enhedspris,
        quantity: p.qty,
        frequency_per_year: p.freq,
        item_revenue: Math.round(enhedspris * p.qty)
      };
    })
  };
  /* Kun med når koden faktisk er valideret server-side. */
  if(state.rabatkode.valid) ev.coupon = state.rabatkode.code;
  /* Måling må aldrig vælte tak-siden. */
  try { dl.push(ev); } catch(e){}
}

/* "booked 2026-07-06T15:15:00" → "Vi ringer til dig i dag ca. kl. 15:15."
   Slottet er dansk vægur-tid; kunderne sidder i praksis i samme tidszone. */
function ringTekst(call){
  const m = /^booked (\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(call || "");
  if(!m) return "";
  const y = +m[1], mo = +m[2], d = +m[3], klok = m[4] + ":" + m[5];
  const nu = new Date(), imorgen = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1);
  const erDag = (dt)=> dt.getFullYear() === y && dt.getMonth() + 1 === mo && dt.getDate() === d;
  const DAGE = ["søndag","mandag","tirsdag","onsdag","torsdag","fredag","lørdag"];
  const dag = erDag(nu) ? "i dag" : erDag(imorgen) ? "i morgen" : "på " + DAGE[new Date(y, mo - 1, d).getDay()];
  return "Vi ringer til dig " + dag + " ca. kl. " + klok + ".";
}

function esc(s){ const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

/* ============ RENDER ============ */
const CAT_ORDER = ["pakke", "groen", "vinduer", "tag", "affald", "vinter", "skadedyr"];
const CAT_LABELS = { pakke:"Pakke", groen:"Grøn have", vinduer:"Vinduer & glas", tag:"Tag & fliser", affald:"Affald", vinter:"Vinter", skadedyr:"Skadedyrsbekæmpelse" };

/* ============ RUNDTUR I BOLIGEN: 3 kategorikort ============ */
/* Services grupperes efter hvor arbejdet foregår: i haven, uden på huset
   eller indendørs. Hvert produkt-id står i præcis ét kort. p.kat beholdes
   uændret (bruges af GTM item_category + tak-sidens logik) — kortene er kun
   en visnings-gruppering ovenpå den samme liste. */
const SERVICE_CARDS = [
  { key:"haven", emoji:"🌳", title:"I haven",
    ids:["graes","green","haek","beskaering","ukrudt_sproejt","ukrudt_fjern","sammenriv"] },
  { key:"ude", emoji:"🏠", title:"Uden på",
    ids:["vinduer","solcelle","drivhus","alge","tagrender","algeflis","fliserens","myre_ude","myre_saeson"] },
  { key:"inde", emoji:"🛋️", title:"Indendørs",
    ids:["vinduerind","myre_inde"] }
];
function enhKort(p){ return p.enhed ? p.enhed.split(" ")[0] : "enhed"; }
function prisEnh(p){ return p.prisEnh || enhKort(p); }   /* ental til "kr pr. X" */

function renderTop(){
  $("t-adr").textContent = state.adresse || "Din adresse";
  renderLosning();
}

/* Fuld gen-render af den samlede serviceliste + priser. Kører kun ved trin-/
   adresse-skift — til-/fravalg gen-renderer IKKE (rækkerne står bomstille). */
function renderLosning(){ renderRows(); opdater(); }

function knap(tegn, label){
  const b = document.createElement("button");
  b.type = "button"; b.textContent = tegn; b.setAttribute("aria-label", label);
  return b;
}

/* ÉN stationær liste: ALLE services (valgte + fravalgte) som ens gule rækker,
   grupperet efter kategori. Til-/fravalg flipper kun checkboxen + .row--off
   (CSS skjuler pris-/frekvens-kontrollerne på stedet) — ingen kolonne-flytning,
   intet farveskift, intet flash. */
/* Rundtur-kortene: 3 klikbare kategorikort (HAVEN / UDEN PÅ / INDENFRA),
   sammenklappede som standard. Et klik på kortet folder dets services ud
   under kortet (accordion) — flere kort kan være åbne samtidig. Checkbox-
   adfærden i rækkerne er uændret (byggRaekke). */
function renderRows(){
  const wrap = $("rows");
  wrap.innerHTML = "";
  SERVICE_CARDS.forEach(card => {
    const items = card.ids.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
    if(!items.length) return;
    const box = document.createElement("div");
    box.className = "tm-card";
    box.dataset.card = card.key;

    const head = document.createElement("button");
    head.type = "button";
    head.className = "tm-card-head";
    head.setAttribute("aria-expanded", "false");
    head.setAttribute("aria-controls", "tm-card-body-" + card.key);
    const emo = document.createElement("span"); emo.className = "tm-card-emoji"; emo.setAttribute("aria-hidden","true"); emo.textContent = card.emoji;
    const ttl = document.createElement("span"); ttl.className = "tm-card-title"; ttl.textContent = card.title;
    const cnt = document.createElement("span"); cnt.className = "tm-card-count"; cnt.dataset.cardCount = card.key; cnt.textContent = "0 valgt";
    const chev = document.createElement("span"); chev.className = "tm-card-chevron"; chev.setAttribute("aria-hidden","true"); chev.textContent = "▾";
    head.appendChild(emo); head.appendChild(ttl); head.appendChild(cnt); head.appendChild(chev);
    head.addEventListener("click", ()=>{
      const open = box.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
      /* Ikke-brydende måling af kort-fold (best effort — må aldrig stoppe flowet). */
      try { (window.dataLayer = window.dataLayer || []).push({ event:"tm_card_expand", tm_card: card.key }); } catch(e){}
    });

    const body = document.createElement("div");
    body.className = "tm-card-body";
    body.id = "tm-card-body-" + card.key;
    items.forEach(p => body.appendChild(byggRaekke(p)));

    box.appendChild(head); box.appendChild(body);
    wrap.appendChild(box);
  });
}

/* Sticky opsummeringslinje: "X ting valgt · Ét besøg klarer det hele · Y kr i alt".
   Samme sum-beregning som overalt ellers (beregn) — live opdateret via opdater(). */
function opdaterSticky(){
  const r = beregn(PRODUCTS);
  const cnt = $("tm-sticky-count"), tot = $("tm-sticky-total");
  if(cnt) cnt.textContent = r.count + " ting valgt";
  if(tot) tot.textContent = kr(r.total) + " i alt";
  /* Pr. kort: antal valgte i hvert kort. */
  SERVICE_CARDS.forEach(card => {
    const el = ROOT.querySelector('[data-card-count="' + card.key + '"]');
    if(!el) return;
    const n = PRODUCTS.filter(p => p.on && card.ids.indexOf(p.id) > -1).length;
    el.textContent = n + " valgt";
  });
}

function byggRaekke(p){
  const row = document.createElement("div");
  row.className = "row" + (p.on ? "" : " row--off");

  const chk = document.createElement("input");
  chk.type = "checkbox"; chk.checked = p.on; chk.dataset.pid = p.id;
  chk.id = "chk-" + p.id;
  const ariaSync = ()=> chk.setAttribute("aria-label", (p.on ? "Fravælg " : "Tilvælg ") + p.navn);
  ariaSync();
  chk.addEventListener("change", ()=>{
    p.on = chk.checked;
    row.classList.toggle("row--off", !p.on);   /* kun state-flip — rækken bliver stående */
    ariaSync();
    opdater();
  });

  /* Titlen er en <label for=checkbox>, så hele navnet toggler rækken. */
  const navn = document.createElement("label");
  navn.className = "navn";
  navn.htmlFor = chk.id;
  navn.textContent = p.navn;

  /* Antal døre, vinduer og porte — til udvendig OG indendørs vinduespudsning tæller
     vi IKKE selv ruderne. Kunden skriver selv, hvor mange der skal pudses, og prisen
     er bare enhedsprisen ganget med det indtastede antal. Tomt felt = ingen pris endnu. */
  let qw = null;
  if(p.id === "vinduer" || p.id === "vinduerind" || p.id === "solcelle"){
    qw = document.createElement("div");
    qw.className = "qw";
    const qlbl = document.createElement("span"); qlbl.className = "qw-lbl";
    qlbl.textContent = (p.id === "solcelle" ? "Antal paneler" : "Antal døre, vinduer og porte");
    const qin = document.createElement("input");
    qin.type = "number"; qin.id = "qty-" + p.id; qin.inputMode = "numeric";
    qin.min = "1"; qin.max = "300"; qin.step = "1";
    qin.placeholder = "f.eks. 12";
    qin.value = p.qty > 0 ? p.qty : "";
    qin.setAttribute("aria-label", p.id === "solcelle"
      ? "Antal paneler til solcellevask"
      : "Antal døre, vinduer og porte til " + (p.id === "vinduerind" ? "indendørs vinduespudsning" : "udvendig vinduesvask"));
    qin.addEventListener("input", ()=>{
      const raw = qin.value.trim();
      if(raw === ""){ p.qty = 0; opdater(); return; }   /* tomt felt = vent på kunden */
      let v = Math.round(Number(raw));
      if(!isFinite(v) || v < 1) v = 1;
      if(v > 300) v = 300;
      if(String(v) !== raw) qin.value = v;              /* korriger minusser/komma/tal med decimaler */
      p.qty = v; p.touched = true;
      opdater();
    });
    qw.appendChild(qlbl); qw.appendChild(qin);
    row.classList.add("qrow");
  }

  /* Pris for ydelen — label over tallet (indhold sættes/animeres af opdater()). */
  const pw = document.createElement("div");
  pw.className = "pw"; pw.dataset.id = p.id;

  /* Frekvens — "Besøg om året" over stepperen. Gælder ALLE rækker (også de indeholdte). */
  const fw = document.createElement("div");
  fw.className = "fw";
  const flbl = document.createElement("span"); flbl.className = "fw-lbl"; flbl.textContent = "Besøg om året";
  const ctl = document.createElement("div"); ctl.className = "fw-ctl";
  const minus = knap("−", "Færre besøg med " + p.navn);
  const fv = document.createElement("b");
  const plus = knap("+", "Flere besøg med " + p.navn);
  function sync(){ fv.textContent = p.freq; minus.disabled = p.freq <= 1; plus.disabled = p.freq >= p.fmax; }
  minus.addEventListener("click", ()=>{ if(p.freq > 1){ p.freq--; sync(); opdater(); } });
  plus.addEventListener("click", ()=>{ if(p.freq < p.fmax){ p.freq++; sync(); opdater(); } });
  sync();
  ctl.appendChild(minus); ctl.appendChild(fv); ctl.appendChild(plus);
  fw.appendChild(flbl); fw.appendChild(ctl);

  row.appendChild(chk); row.appendChild(navn);
  if(qw) row.appendChild(qw);
  row.appendChild(pw); row.appendChild(fw);
  return row;
}

/* Rabatkode-banner på løsnings-trinnet. Mængderabatten er fjernet — prisen
   er bare summen af de valgte services. Kr-beløbet tæller blødt op/ned. */
function opdaterRabat(){
  var el = $("tm-rabat");
  if(!el) return;
  var r = beregn(PRODUCTS);
  /* Rabatkode (fra kontakt-trinnet): vis den også her, så kunden ser koden
     ramme prisen med det samme — samme regnestykke som ved indsendelsen. */
  var kodePct = state.rabatkode.valid ? state.rabatkode.percent : 0;
  var kodeKr = r.total * kodePct / 100;
  var kodeHtml = kodePct > 0
    ? '<span class="tm-rabat-kode">Rabatkode <b>' + esc(state.rabatkode.code) + '</b>: ekstra <b>−' + kodePct + '%</b>' +
      (kodeKr > 0 ? ' (ca. <span class="tm-kode-kr tm-anim-kr">' + kr(kodeKr) + '</span>)' : '') + '</span>'
    : '';
  if(kodePct > 0){
    el.innerHTML = kodeHtml;
    delete el.dataset.kr;
    el.hidden = false;
  } else {
    delete el.dataset.kr;
    el.hidden = true;
  }
  /* Kode-kr'et tæller også blødt, når mængder/valg ændrer sig. */
  var prevKode = parseFloat(el.dataset.kodekr);
  if(kodeKr > 0){
    if(isFinite(prevKode) && prevKode !== kodeKr) animateNumber(el.querySelector(".tm-kode-kr"), prevKode, kodeKr, kr);
    el.dataset.kodekr = kodeKr;
  } else {
    delete el.dataset.kodekr;
  }
}

function opdater(){
  PRODUCTS.forEach(p => {
    const el = ROOT.querySelector('.pw[data-id="' + p.id + '"]');
    if(!el) return;
    if(p.pris == null){
      el.innerHTML = '<span class="pw-note">' + (p.pakke ? "Indeholdt i pakken" : "Pris ved besøg") + '</span>';
      delete el.dataset.val;
    } else if(!p.qty){
      el.innerHTML = '<span class="pw-note">Pris efter antal</span>';
      delete el.dataset.val;
    } else {
      const val = p.pris * p.qty;
      const prev = parseFloat(el.dataset.val);
      const b = el.querySelector(".pw-val");
      if(!b){   /* første visning: skriv direkte (ingen animation fra ingenting) */
        el.innerHTML = '<b class="pw-val">' + kr(val) + '</b><span class="pw-unit">i alt</span>';
      } else if(isFinite(prev) && prev !== val){
        animateNumber(b, prev, val, kr);   /* mængde ændret → tæl blødt derhen */
      } else {
        b.textContent = kr(val);
      }
      el.dataset.val = val;
    }
  });
  opdaterRabat();
  opdaterBetaling();
  opdaterSticky();
  gemState("step-losning");   /* hver frekvens-/til-fravalgs-ændring overlever refresh */
}

/* ============ GENDAN (kør sidst — alle handlers er nu på plads) ============ */
/* Sitedækkende kundetype først: har kunden allerede valgt privat/erhverv
   (forside-modal eller header-switch), forudvælges kortet på trin 2 — trinnet
   VISES stadig, og kunden bekræfter selv med "Videre". Kør FØR gendan(), så
   sessionens eget valg vinder ved gendannelse. */
(function(){
  try {
    const t = localStorage.getItem(KUNDETYPE_KEY);
    if(t === "privat" || t === "erhverv") vaelgKundetype(t);
  } catch(e){ /* private mode — best effort */ }
})();
(function gendan(){
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(PERSIST_KEY) || "null"); } catch(e){ return; }
  if(!s || !s.adresse || Date.now() - (s.t || 0) > 3600e3) return;
  if(["step-kundetype","step-verify","step-losning","step-kontakt"].indexOf(s.step) === -1) return;

  state.adresse = s.adresse;
  adrInput.value = s.adresse;
  if(s.kundetype === "privat" || s.kundetype === "erhverv") vaelgKundetype(s.kundetype);
  if(s.betaling === "pr_gang") vaelgBetaling(s.betaling);
  if(s.prod) PRODUCTS.forEach(p => {
    const d = s.prod[p.id];
    if(d){ p.on = !!d.on; if(typeof d.qty === "number") p.qty = d.qty; if(typeof d.freq === "number") p.freq = d.freq; p.touched = !!d.touched; }
  });
  /* Rabatkode: gendan koden i feltet og genanvend noten/procenten (stille —
     ingen count-animation), så en indtastet kode overlever refresh. */
  if(s.rabatkode && s.rabatkode.code && rkInput){
    rkInput.value = s.rabatkode.code;
    const pct = Math.max(0, Math.min(100, Number(s.rabatkode.percent) || 0));
    if(s.rabatkode.valid === true && pct > 0){
      state.rabatkode = { code: String(s.rabatkode.code), percent: pct, valid: true };
      rkNote("rk-ok", 'Rabatkode anvendt: <b>−' + pct + '%</b>');
    }
  }
  /* Skråfoto + auto-mål genstartes i baggrunden (stale-guard beskytter
     brugerens gendannede mængder via touched-flaget). */
  renderSkraafoto(VERIFY_DIRS[0]);
  const req = ++measureReq;
  if(window.KARLTOFFEL && window.KARLTOFFEL.measureProperty){
    window.KARLTOFFEL.measureProperty(s.adresse).then(function(m){ if(req === measureReq) applyMeasurements(m); });
  }
  visStep(s.step, true);   /* stille: intet scroll-hop, ingen fokus-tyveri */
})();

})();
