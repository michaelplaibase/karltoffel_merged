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
/* Priser + enheder bekræftet mod WorkMaker-CSV (04.07.2026). Alle 9 linjer matcher. */
/*PRICING-START*/
const PRODUCTS = [
  /* ---- Villapakken (standard) ---- */
  {id:"vinduer",  navn:"Vinduespudsning udvendig",       enhed:"glas",       pris:15.30, note:"Udvendige ruder",                 qty:14,  freq:6,  fmax:12, on:true,  pakke:true},
  {id:"haek",     navn:"Hækklipning",                    enhed:"m hæk",      pris:27.50, note:"1 side, under 220 cm",            qty:65,  freq:1,  fmax:3,  on:true,  pakke:true},
  {id:"green",    navn:"Greenkeeper græspleje",          enhed:"m² græs",    pris:2.30,  note:"Gødning og pleje af plænen",      qty:450, freq:4,  fmax:6,  on:true,  pakke:true},
  {id:"alge",     navn:"Algerens tag, facade & fliser",  enhed:"m² tag",     pris:4.20,  note:"Tag, facade, fliser og terrasse", qty:120, freq:1,  fmax:2,  on:true,  pakke:true},
  {id:"tagrender",navn:"Tagrenderens",                   enhed:"m tagrende", pris:18.00, note:"Stueplan / 1-plans hus",          qty:24,  freq:1,  fmax:2,  on:true,  pakke:true},
  {id:"robot",    navn:"Robotplæneklipper service",      enhed:"",           pris:null,  note:"Indeholdt i pakken",              qty:1,   freq:2,  fmax:4,  on:true,  pakke:true},
  {id:"husgarage",navn:"Vask af hus/garage ned",         enhed:"",           pris:null,  note:"Indeholdt i pakken",              qty:1,   freq:1,  fmax:2,  on:true,  pakke:true},
  {id:"service",  navn:"Servicering af vinduer og døre", enhed:"",           pris:null,  note:"Indeholdt i pakken",              qty:1,   freq:1,  fmax:2,  on:true,  pakke:true},

  /* ---- Tilvalg: "Vi tilbyder også" (off som standard, gruppe = kat) ---- */
  {id:"ukrudt",    navn:"Ukrudtsbekæmpelse på belægning",         enhed:"m² fliser", pris:1.50,   note:"Vi holder fugerne rene",  qty:60,  freq:5,  fmax:8,  on:false, pakke:false, kat:"groen"},
  {id:"graes",     navn:"Græsslåning",                            enhed:"m² græs",   pris:1.60,   note:"Klip i sæsonen",          qty:450, freq:16, fmax:26, on:false, pakke:false, kat:"groen"},
  {id:"beskaering",navn:"Beskæring af buske, træer og planter",   enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:2,  on:false, pakke:false, kat:"groen"},
  {id:"soignering",navn:"Soignering af bede",                     enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:4,  fmax:12, on:false, pakke:false, kat:"groen"},
  {id:"stub",      navn:"Stubfræsning",                           enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:1,  on:false, pakke:false, kat:"groen"},
  {id:"vinduerind",navn:"Vinduesvask indvendigt",                 enhed:"glas",      pris:19.87,  note:"Indvendige ruder",        qty:14,  freq:1,  fmax:6,  on:false, pakke:false, kat:"vinduer"},
  {id:"ovenlys",   navn:"Ovenlysvinduesvask",                     enhed:"stk",       pris:25.00,  note:"Pr. ovenlysvindue",       qty:2,   freq:1,  fmax:4,  on:false, pakke:false, kat:"vinduer"},
  {id:"solcelle",  navn:"Solcellevask",                           enhed:"paneler",   pris:25.00,  note:"Pr. solcellepanel",       qty:0,   freq:1,  fmax:4,  on:false, pakke:false, kat:"vinduer"},
  {id:"drivhus",   navn:"Drivhusvask",                            enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:2,  on:false, pakke:false, kat:"vinduer"},
  {id:"fliserens", navn:"Fliserens",                              enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:2,  on:false, pakke:false, kat:"tag"},
  {id:"sedum",     navn:"Gødning af Sedumtag",                    enhed:"m² tag",    pris:21.00,  note:"Pr. m² sedumtag",         qty:0,   freq:1,  fmax:2,  on:false, pakke:false, kat:"tag"},
  {id:"haveaffald",navn:"Haveaffald (genbrugsafgift)",           enhed:"gang",      pris:600.00, note:"Pr. bortskaffelse",       qty:1,   freq:1,  fmax:6,  on:false, pakke:false, kat:"affald"},
  {id:"sammenriv", navn:"Sammenrivning & bortskaffelse af affald",enhed:"m² græs",   pris:3.00,   note:"Åbne arealer",            qty:450, freq:2,  fmax:4,  on:false, pakke:false, kat:"affald"},
  {id:"sne",       navn:"Snerydning og saltning",                 enhed:"",          pris:null,   note:"Pris ved besøg",          qty:1,   freq:1,  fmax:20, on:false, pakke:false, kat:"vinter"}
];

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
  ejendom: { type:"Fritidshus", grund:"827 m²", opfoert:"2007", haek:"65 m" }
};

/* ============ ADRESSEOPSLAG: Adressevælgeren (DAWAs officielle afløser) ============ */
const ADR_API = "https://adressevaelger.dk/husnumre/soeg?token=adressevaelger123&maksimum=6&tekst=";
const DEMO_ADR = ["Sundvej 8, 8700 Horsens","Strandkærvej 30, 8700 Horsens","Bygholm Parkvej 1, 8700 Horsens"];
let adrTimer = null, adrFejl = false;

const adrInput = $("adr-input"), adrList = $("adr-list"), adrNote = $("adr-note");

adrInput.addEventListener("input", ()=>{
  const q = adrInput.value.trim();
  clearTimeout(adrTimer);
  if(q.length < 3){ lukListe(); return; }
  adrTimer = setTimeout(()=>soegAdresse(q), 250);
});

function soegAdresse(q){
  if(adrFejl){ visDemoListe(); return; }
  fetch(ADR_API + encodeURIComponent(q))
    .then(r => { if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      const fund = (data && data.fund) ? data.fund : [];
      const hits = fund.filter(f => f.type === "husnummer").map(f => f.titel);
      if(hits.length){ visListe(hits, false); }
      else if(fund.length){ visListe(fund.slice(0,5).map(f => f.titel), true); }
      else { visListe([], true); }
    })
    .catch(()=>{ adrFejl = true; adrNote.classList.add("show"); visDemoListe(); });
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
  const put = (id,v)=>{ if(v>0){ const p = PRODUCTS.find(x=>x.id===id); if(p) p.qty = v; } };
  put("graes", m.haveAreal); put("green", m.haveAreal); put("sammenriv", m.haveAreal);
  put("haek", m.haekLangde); put("tagrender", m.tagrendeLangde); put("alge", m.tagAreal);
  const hint = ROOT.querySelector(".demo-hint");
  if(hint){
    let t = "Målt automatisk fra matrikel + skråfoto/DHM: grund " + m2(m.grundAreal) + ", have " + m2(m.haveAreal);
    if(m.tagAreal) t += ", tag " + m2(m.tagAreal) + (m.taghaeldning ? " (hældn. " + m.taghaeldning + "°)" : "");
    t += ", hæk-omkreds " + DKK0.format(m.haekLangde) + " m" + (m.haekHojde ? " (~" + String(m.haekHojde).replace(".",",") + " m høj)" : "");
    t += ". Ret mængderne direkte i listen.";
    hint.textContent = t;
  }
  const active = ROOT.querySelector(".step.active");
  if(active && active.id === "step-losning") renderTop();
}

function vaelgAdresse(titel){
  state.adresse = titel;
  lukListe();
  adrInput.value = titel;
  verifyDir = 0; setVerifyHint("");
  if(btnNej) btnNej.textContent = "Nej, prøv igen";
  /* Hent skråfoto parallelt med grave-animationen (fejler stille → SVG-fallback). */
  renderSkraafoto(VERIFY_DIRS[0]);
  /* Auto-mål i baggrunden → forudfylder beregneren når kunden når dertil. */
  if(window.KARLTOFFEL && window.KARLTOFFEL.measureProperty){
    window.KARLTOFFEL.measureProperty(titel).then(applyMeasurements);
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
  const valgte = PRODUCTS.filter(p=>p.on && p.pris*p.qty*p.freq>0).map(p=>p.navn + " (" + p.freq + "x/år)").join(", ");
  $("tak-opsum").innerHTML =
    "<b>" + esc(state.adresse) + "</b><br>" +
    "Valgt: " + esc(valgte) + "<br>" +
    "Estimeret: <b>" + kr(r.md) + "/md</b> ved " + r.visits + " besøg om året.<br><br>" +
    "Demo: intet er sendt endnu. I produktion oprettes lead + tilbud i WorkMaker her.";
  visStep("step-tak");
});

function esc(s){ const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

/* ============ RENDER ============ */
const CAT_ORDER = ["groen", "vinduer", "tag", "affald", "vinter"];
const CAT_LABELS = { groen:"Grøn have", vinduer:"Vinduer & glas", tag:"Tag & fliser", affald:"Affald", vinter:"Vinter" };
function enhKort(p){ return p.enhed ? p.enhed.split(" ")[0] : "enhed"; }

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
    const incl = (p.pris == null);              /* "indeholdt" — ingen mængde/pris */
    const row = document.createElement("div");
    row.className = "row" + (incl ? " row--incl" : "");

    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.checked = true;
    chk.setAttribute("aria-label", "Fravælg " + p.navn);
    chk.addEventListener("change", ()=>{ p.on = false; renderLosning(); });

    const navn = document.createElement("div");
    navn.className = "navn";
    const sub = incl ? p.note : (p.note + " · " + DKK2.format(p.pris) + " kr pr. " + enhKort(p));
    navn.innerHTML = "<b>" + esc(p.navn) + "</b><small>" + esc(sub) + "</small>";

    const qty = document.createElement("div");
    qty.className = "qty";
    if(!incl){
      const qi = document.createElement("input");
      qi.type = "number"; qi.min = "0"; qi.value = p.qty; qi.inputMode = "numeric";
      qi.setAttribute("aria-label", "Mængde for " + p.navn + " i " + p.enhed);
      qi.addEventListener("input", ()=>{ p.qty = Math.max(0, parseFloat(qi.value) || 0); opdater(); });
      const ql = document.createElement("span"); ql.textContent = p.enhed;
      qty.appendChild(qi); qty.appendChild(ql);
    }

    const freq = document.createElement("div");
    freq.className = "freq";
    const minus = knap("−", "Færre besøg med " + p.navn);
    const fv = document.createElement("span"); fv.className = "fv";
    const plus = knap("+", "Flere besøg med " + p.navn);
    function sync(){
      fv.textContent = p.freq + "x pr. år";
      minus.disabled = p.freq <= 1; plus.disabled = p.freq >= p.fmax;
    }
    minus.addEventListener("click", ()=>{ if(p.freq > 1){ p.freq--; sync(); opdater(); } });
    plus.addEventListener("click", ()=>{ if(p.freq < p.fmax){ p.freq++; sync(); opdater(); } });
    sync();
    freq.appendChild(minus); freq.appendChild(fv); freq.appendChild(plus);

    const pris = document.createElement("div");
    pris.className = "pris"; pris.dataset.id = p.id;

    row.appendChild(chk); row.appendChild(navn); row.appendChild(qty);
    row.appendChild(freq); row.appendChild(pris);
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
      chk.type = "checkbox"; chk.checked = false;
      chk.setAttribute("aria-label", "Tilvælg " + p.navn);
      chk.addEventListener("change", ()=>{ p.on = true; renderLosning(); });
      const txt = document.createElement("span");
      const prisTxt = (p.pris == null) ? "pris ved besøg" : (DKK2.format(p.pris) + " kr/" + enhKort(p));
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
      ? "<b>Indeholdt</b>"
      : "<b>" + kr(linjeMd(p)) + "/md</b><small>" + kr(p.pris * p.qty * p.freq) + " pr. år</small>";
  });
  const r = beregn(PRODUCTS);
  $("t-count").textContent = r.count;
  $("t-visits").textContent = r.visits;
  $("t-pris").textContent = kr(r.md);
  $("cta-pris").textContent = kr(r.md) + "/md";
  $("cta-detalje").textContent = r.count + " services · " + r.visits + " besøg om året · estimat";
}

})();
