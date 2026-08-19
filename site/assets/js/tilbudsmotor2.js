/* ==========================================================================
   Karltoffel Tilbudsmotor 2 — tre skærme, ét spørgsmål ad gangen.
   --------------------------------------------------------------------------
   Bygget efter forslaget "Tre spørgsmål, én pris". Den gamle motor
   (assets/js/tilbudsmotor.js) er urørt og kører videre på forsiden — denne
   ligger på /tilbud, så de to kan sammenlignes side om side.

   Flowet:
     1. Hvilken opgave?          — ét tryk, seks felter
     2. Adresse + omfang         — ét felt, ét valg, live pris i bunden
     3. Pris + navn og telefon   — to felter, resten er valgfrit

   Bevidst IKKE med (se forslaget):
     - Ja/nej-bekræftelse af skråfotoet. Billedet vises som tryghed, ikke som
       port: loader det ikke, sker der ingenting. Der er ikke noget at fejle
       ind i, og kunden bliver aldrig sendt tilbage til adressefeltet.
     - Frekvens-steppere. Antal besøg er vores anbefaling, ikke kundens
       opgave — det aftales på opkaldet.
     - Mængderabat og betalingsvalg. Begge dele hører til i samtalen med
       Kristian, ikke i en formular.

   Lead-kontrakten mod CRM'et er uændret (app/api/leads/route.ts). Vi sender
   ét element i services[] i stedet for seks, og source="tilbudsmotor2" så de
   to motorer kan skelnes i CRM'et under sammenligningen.
   ========================================================================== */
(function(){
"use strict";

var ROOT = document.getElementById("tilbudsmotor");
if(!ROOT) return;
function $(id){ return ROOT.querySelector("#" + id); }

/* ============ YDELSER ============
   Enhedspriserne er hentet 1:1 fra PRODUCTS i den gamle motor, som igen er
   sat efter WorkMaker-CSV'en (04.07.2026). `wm` er det verbatime
   WorkMaker-produktnavn og eneste join-nøgle — inkl. CSV'ens stavefejl.

   `baand` er omfangsvalget: tre menneskelige størrelser i stedet for et
   talfelt. Mængderne er typetal for danske parcelhuse; den præcise opmåling
   sker, når vi står der. Rækkefølgen er lille → typisk → stor, og den
   midterste er forvalgt, fordi den rammer flest.

   ÅBENT PUNKT (Michael): de seks indgange er valgt ud fra kataloget og
   /p/det-vi-ordner. Har I søgeordsdata fra Google Ads, er det dem, der skal
   bestemme — så ret listen her, resten af motoren følger med. */
var YDELSER = [
  {
    id:"haek", navn:"Hækklipning", kort:"Hækklipning",
    under:"1 side, under 220 cm",
    enhed:"m hæk", pris:27.50, wm:"Hækklipning 1 side pr meter Under 220 cm",
    spg:"Hvor lang er hækken?",
    baand:[
      {navn:"Forhaven",        qty:25,  hint:"ca. 25 m"},
      {navn:"Typisk parcelhus",qty:65,  hint:"ca. 65 m"},
      {navn:"Stor grund",      qty:120, hint:"ca. 120 m"}
    ],
    ikon:'<path d="M4 20h16M6 20V9M12 20V6M18 20v-8"/><path d="M3 9h6M9 6h6M15 12h6"/>'
  },
  {
    id:"vinduer", navn:"Vinduespudsning udvendig", kort:"Vinduespudsning",
    under:"Udvendige ruder",
    enhed:"glas", pris:15.30, wm:"Vinduespudsning udvendig pr glas",
    spg:"Hvor mange ruder har huset?",
    baand:[
      {navn:"Rækkehus",        qty:10, hint:"ca. 10 ruder"},
      {navn:"Typisk villa",    qty:16, hint:"ca. 16 ruder"},
      {navn:"Stort hus",       qty:28, hint:"ca. 28 ruder"}
    ],
    ikon:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/>'
  },
  {
    id:"alge", navn:"Algebehandling af tag", kort:"Alger på taget",
    under:"Mos og alger på tagfladen",
    enhed:"m² tag", pris:4.20, wm:"Algebehandling af tag",
    spg:"Hvor stort er taget?",
    baand:[
      {navn:"Lille tag",       qty:60,  hint:"ca. 60 m²"},
      {navn:"Typisk parcelhus",qty:120, hint:"ca. 120 m²"},
      {navn:"Stort tag",       qty:200, hint:"ca. 200 m²"}
    ],
    ikon:'<path d="M3 12 12 4l9 8"/><path d="M6 11v9h12v-9"/><path d="M9.5 15.5c1.5-1 3.5-1 5 0"/>'
  },
  {
    id:"graes", navn:"Græsslåning", kort:"Græsslåning",
    under:"Klip i sæsonen",
    enhed:"m² plæne", pris:1.60, wm:"Græsslåning",
    spg:"Hvor stor er plænen?",
    baand:[
      {navn:"Lille have",      qty:150, hint:"ca. 150 m²"},
      {navn:"Typisk parcelhus",qty:450, hint:"ca. 450 m²"},
      {navn:"Stor grund",      qty:900, hint:"ca. 900 m²"}
    ],
    ikon:'<path d="M4 20h16"/><path d="M6 20c0-4 1-6 2-7M12 20c0-5 1-8 2-9M18 20c0-3-.6-5-1.5-6"/>'
  },
  {
    id:"tagrender", navn:"Tagrenderens", kort:"Tagrender",
    under:"Stueplan / 1-plans hus",
    enhed:"m tagrende", pris:18.00, wm:"Tagrenderens Stueplan / 1-plans hus",
    spg:"Hvor mange meter tagrende?",
    baand:[
      {navn:"Lille hus",       qty:18, hint:"ca. 18 m"},
      {navn:"Typisk parcelhus",qty:24, hint:"ca. 24 m"},
      {navn:"Stort hus",       qty:40, hint:"ca. 40 m"}
    ],
    ikon:'<path d="M3 9 12 4l9 5"/><path d="M4 11h16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 19v2M16 19v2"/>'
  },
  {
    /* Uden pris: går uden om omfangsvalget og direkte til kontakt. Der findes
       altid en opgave, vi ikke har sat i kasse — den må ikke være en blindgyde. */
    id:"andet", navn:"Noget andet", kort:"Noget andet",
    under:"Fortæl os hvad — vi ringer",
    enhed:"", pris:null, wm:null,
    spg:null, baand:null,
    ikon:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.2 2.5c-.5.2-.7.6-.7 1.1v.4"/><path d="M12 17.2v.2"/>'
  }
];

/* Prisintervallet. Michael valgte interval frem for fast tal: vi viser et
   ærligt spænd og siger hvorfor, i stedet for et præcist tal vi bagefter
   tager forbehold for. ±12 % om typetallet, rundet til nærmeste 50 kr. */
var SPAEND = 0.12, RUND = 50;

/* ÅBENT PUNKT (Michael/Kristian): minimumspris for et besøg. Med de rene
   enhedspriser lander små opgaver lavt (18 kr/m × 18 m tagrende = 324 kr),
   og det dækker næppe udkørslen. Den gamle motor har samme regnestykke, så
   det er ikke nyt — men sæt tallet her, når I har besluttet det. 0 = slået fra. */
var MIN_BESOEG = 0;

/* ============ STATE ============ */
var state = {
  ydelse: null,      /* objekt fra YDELSER */
  adresse: "",
  baandIdx: 1,       /* midterste er forvalgt — den rammer flest */
  kundetype: "privat"
};

var DKK = new Intl.NumberFormat("da-DK",{maximumFractionDigits:0});
function kr(n){ return DKK.format(Math.round(n)) + " kr"; }
function esc(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }

/* ============ PRIS ============ */
function mængde(){
  if(!state.ydelse || !state.ydelse.baand) return 0;
  var b = state.ydelse.baand[state.baandIdx];
  return b ? b.qty : 0;
}
function grundpris(){
  var y = state.ydelse;
  if(!y || y.pris == null) return 0;
  return Math.max(MIN_BESOEG, y.pris * mængde());
}
/* Intervallet vises til kunden; punktestimatet er det, CRM'et får, så
   Kristian har ét tal at regne videre på. */
function interval(){
  var p = grundpris();
  if(!p) return null;
  var lav = Math.max(RUND, Math.round(p * (1 - SPAEND) / RUND) * RUND);
  var hoej = Math.round(p * (1 + SPAEND) / RUND) * RUND;
  if(hoej <= lav) hoej = lav + RUND;
  return { lav: lav, hoej: hoej, punkt: p };
}
function intervalTekst(){
  var i = interval();
  if(!i) return "Pris ved besøg";
  return DKK.format(i.lav) + "–" + DKK.format(i.hoej) + " kr";
}

/* ============ TRIN ============ */
var TRIN = ["step-ydelse","step-omfang","step-kontakt"];
function visStep(id, stille){
  ROOT.querySelectorAll(".step").forEach(function(s){ s.classList.remove("active"); });
  var el = $(id);
  if(!el) return;
  el.classList.add("active");

  var idx = TRIN.indexOf(id);
  var prog = $("tm2-progress");
  if(prog){
    prog.style.visibility = idx > -1 ? "visible" : "hidden";
    if(idx > -1){
      $("tm2-progress-txt").textContent = "Trin " + (idx+1) + " af 3";
      var dots = $("tm2-dots").children;
      for(var i=0;i<dots.length;i++) dots[i].classList.toggle("on", i <= idx);
    }
  }
  opdaterBar(id);
  if(!stille){
    window.scrollTo(0, 0);
    var h = el.querySelector("h1");
    if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); }
  }
  gem(id);
}

/* ============ BUNBJÆLKEN ============
   Én bjælke, tre tilstande. Den er den eneste vej frem, så kunden aldrig
   skal lede efter næste skridt — og den sidder, hvor tommelfingeren er. */
function opdaterBar(stepId){
  var bar = $("tm2-bar"), label = $("bar-label"), tal = $("bar-tal"),
      btn = $("bar-btn"), tilbage = $("bar-tilbage");
  if(!bar) return;

  if(stepId === "step-tak"){ bar.classList.add("skjul"); return; }
  bar.classList.remove("skjul");
  tilbage.style.display = stepId === "step-ydelse" ? "none" : "grid";

  if(stepId === "step-ydelse"){
    label.textContent = "Vælg en opgave";
    tal.textContent = "Så regner vi prisen";
    btn.textContent = "Videre";
    btn.disabled = true;
    return;
  }
  if(stepId === "step-omfang"){
    var harPris = state.ydelse && state.ydelse.pris != null;
    label.textContent = harPris ? "Anslået pr. besøg" : "Pris";
    tal.textContent = harPris ? intervalTekst() : "Vi ringer og aftaler";
    btn.textContent = "Videre";
    btn.disabled = !state.adresse;
    return;
  }
  /* Kontakt */
  label.textContent = state.ydelse && state.ydelse.pris != null ? "Anslået pr. besøg" : "Pris";
  tal.textContent = state.ydelse && state.ydelse.pris != null ? intervalTekst() : "Vi ringer og aftaler";
  btn.textContent = "Send";
  btn.disabled = false;
}

/* ============ SKÆRM 1: YDELSER ============ */
(function byggYdelser(){
  var wrap = $("ydelser");
  YDELSER.forEach(function(y){
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ydelse";
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + y.ikon + '</svg>' +
      '<span><b>' + esc(y.kort) + '</b><small>' + esc(y.under) + '</small></span>';
    b.addEventListener("click", function(){ vaelgYdelse(y); });
    wrap.appendChild(b);
  });
})();

function vaelgYdelse(y){
  state.ydelse = y;
  state.baandIdx = 1;
  $("omfang-titel").textContent = y.spg || "Hvor skal vi komme hen?";
  $("omfang-ydelse").textContent = y.kort;
  byggOmfang();
  visStep("step-omfang");
}

/* ============ SKÆRM 2: OMFANG ============ */
function byggOmfang(){
  var wrap = $("omfang"), y = state.ydelse;
  wrap.innerHTML = "";
  if(!y || !y.baand){ wrap.hidden = true; $("omfang-note").hidden = true; return; }
  wrap.hidden = false; $("omfang-note").hidden = false;

  y.baand.forEach(function(b, i){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "omfang-kort";
    btn.setAttribute("role","radio");
    btn.setAttribute("aria-checked", i === state.baandIdx ? "true" : "false");
    btn.innerHTML = '<b>' + esc(b.navn) + '</b><small>' + esc(b.hint) + '</small>';
    btn.addEventListener("click", function(){
      state.baandIdx = i;
      wrap.querySelectorAll(".omfang-kort").forEach(function(k, j){
        k.setAttribute("aria-checked", j === i ? "true" : "false");
      });
      opdaterBar("step-omfang");   /* prisen i bjælken følger med med det samme */
      gem("step-omfang");
    });
    wrap.appendChild(btn);
  });
}

/* ============ ADRESSE ============
   Samme opslag som den gamle motor (adressevaelger.dk). Fejler kaldet, låser
   vi ikke flowet: kunden kan skrive adressen i hånden og komme videre. */
var ADR_API = "https://adressevaelger.dk/husnumre/soeg?token=adressevaelger123&maksimum=6&tekst=";
var adrInput = $("adr"), adrListe = $("adr-liste"), adrTimer = null;

adrInput.addEventListener("input", function(){
  var q = adrInput.value.trim();
  state.adresse = q.length >= 3 ? q : "";
  opdaterBar("step-omfang");
  clearTimeout(adrTimer);
  if(q.length < 3){ lukListe(); return; }
  adrTimer = setTimeout(function(){ soeg(q); }, 250);
});

function soeg(q){
  fetch(ADR_API + encodeURIComponent(q))
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(data){
      var fund = (data && data.fund) ? data.fund : [];
      var hits = fund.filter(function(f){ return f.type === "husnummer"; }).map(function(f){ return f.titel; });
      if(hits.length) visListe(hits);
      else if(fund.length) visListe(fund.slice(0,5).map(function(f){ return f.titel; }), true);
      else visListe([]);
    })
    .catch(function(){ lukListe(); });   /* API nede → kunden skriver bare selv */
}

function visListe(items, erHint){
  adrListe.innerHTML = "";
  items.forEach(function(t){
    var b = document.createElement("button");
    b.type = "button"; b.textContent = t;
    b.addEventListener("click", function(){ vaelgAdresse(t); });
    adrListe.appendChild(b);
  });
  if(!items.length || erHint){
    var h = document.createElement("div");
    h.className = "adr-hint";
    h.textContent = items.length ? "Skriv husnummer med for at ramme præcist." : "Ingen match endnu — skriv lidt mere.";
    adrListe.appendChild(h);
  }
  adrListe.classList.add("open");
}
function lukListe(){ adrListe.classList.remove("open"); adrListe.innerHTML = ""; }
document.addEventListener("click", function(e){ if(!e.target.closest(".adr-wrap")) lukListe(); });

function vaelgAdresse(t){
  state.adresse = t;
  adrInput.value = t;
  lukListe();
  adrInput.blur();                 /* luk tastaturet, så omfangsvalget bliver synligt */
  hentFoto(t);
  opdaterBar("step-omfang");
  gem("step-omfang");
}

/* ============ SKRÅFOTO — tryghed, ikke port ============
   Kristians rettelse: kunden skal kunne se, at vi kigger på den rigtige
   adresse. Men billedet stiller ingen spørgsmål og spærrer ingenting.

   REGEL 7 (vægt): skraafoto.js trækker geotiff.min.js på 310 KB. Den hentes
   derfor FØRST her — når adressen er valgt — i stedet for ved sidevisning.
   Kunden på skærm 1 betaler ikke for et billede, de endnu ikke har bedt om.

   NÆSTE SKRIDT (fase 2): serveren tegner udsnittet og sender et JPEG, så
   både de 310 KB og Dataforsyningen-tokenet forlader browseren helt.
   CRM'et har allerede proxyen (app/api/skraafoto/*, lib/skraafoto-proxy.ts). */
var fotoIndlaest = false, fotoKoe = null;
function hentFoto(adresse){
  var kort = ROOT.querySelector(".foto-card");
  if(!kort) return;
  if(fotoIndlaest){ tegnFoto(adresse); return; }
  fotoKoe = adresse;
  fotoIndlaest = true;
  indlaesScripts([
    "/assets/js/vendor/geotiff.min.js",
    "/assets/js/tilbudsmotor.config.js",
    "/assets/js/skraafoto.js"
  ], function(){ if(fotoKoe) tegnFoto(fotoKoe); });
}
function tegnFoto(adresse){
  var NS = window.KARLTOFFEL;
  if(NS && typeof NS.skraafotoRender === "function"){
    /* Kaster aldrig — fejler den, står kortet bare tomt, og flowet er upåvirket. */
    NS.skraafotoRender(adresse, "north");
  }
}
function indlaesScripts(liste, done){
  var i = 0;
  (function næste(){
    if(i >= liste.length){ done(); return; }
    var s = document.createElement("script");
    s.src = liste[i++];
    s.onload = næste;
    s.onerror = næste;              /* et manglende script må ikke standse resten */
    document.head.appendChild(s);
  })();
}

/* "Ikke dit hus?" — et link tilbage til feltet, ikke en ja/nej-beslutning. */
$("foto-skift").addEventListener("click", function(){
  adrInput.value = ""; state.adresse = "";
  var kort = ROOT.querySelector(".foto-card");
  if(kort) kort.classList.remove("has-photo");
  opdaterBar("step-omfang");
  adrInput.focus();
});

/* ============ KUNDETYPE ============ */
["privat","erhverv"].forEach(function(t){
  $("kt-" + t).addEventListener("click", function(){
    state.kundetype = t;
    $("kt-privat").setAttribute("aria-checked", t === "privat" ? "true" : "false");
    $("kt-erhverv").setAttribute("aria-checked", t === "erhverv" ? "true" : "false");
    $("cvr-felt").hidden = t !== "erhverv";
    try { localStorage.setItem("kt-kundetype-v1", t); } catch(e){}
    gem("step-kontakt");
  });
});

/* ============ NAVIGATION ============ */
$("bar-btn").addEventListener("click", function(){
  var aktiv = ROOT.querySelector(".step.active");
  if(!aktiv) return;
  if(aktiv.id === "step-omfang"){
    if(!state.adresse){ adrInput.focus(); return; }
    visKontakt();
    return;
  }
  if(aktiv.id === "step-kontakt") send();
});
$("bar-tilbage").addEventListener("click", function(){
  var aktiv = ROOT.querySelector(".step.active");
  if(!aktiv) return;
  if(aktiv.id === "step-omfang") visStep("step-ydelse");
  else if(aktiv.id === "step-kontakt") visStep("step-omfang");
});

function visKontakt(){
  var y = state.ydelse, i = interval();
  $("pris-tal").textContent = i ? intervalTekst() : "Pris ved besøg";
  $("pris-hvad").textContent = y
    ? y.navn + (y.baand ? " — " + DKK.format(mængde()) + " " + y.enhed : "")
    : "";
  $("pris-forbehold").textContent = i
    ? "Vi måler op, når vi står der, og bekræfter prisen på telefonen. Priserne er inkl. moms."
    : "Vi ringer og aftaler prisen med dig. Priserne er inkl. moms.";
  visStep("step-kontakt");
}

/* ============ PERSISTENS ============
   sessionStorage frem for localStorage: dør med fanen, ingen samtykke-
   problematik. Mobilbrugere skifter app hele tiden — flowet skal overleve. */
var NØGLE = "tm2-state-v1";
function gem(stepId){
  try{
    if(!state.ydelse) return;
    sessionStorage.setItem(NØGLE, JSON.stringify({
      t: Date.now(), ydelse: state.ydelse.id, adresse: state.adresse,
      baandIdx: state.baandIdx, kundetype: state.kundetype, step: stepId
    }));
  }catch(e){}
}
function ryd(){ try{ sessionStorage.removeItem(NØGLE); }catch(e){} }

/* ============ SEND ============ */
function send(){
  var navn = $("k-navn").value.trim(),
      tlf  = $("k-tlf").value.trim(),
      mail = $("k-mail").value.trim();

  if(!navn || tlf.replace(/\D/g,"").length < 8){
    fejl("Udfyld navn og telefonnummer, så vi kan ringe dig op.");
    $( navn ? "k-tlf" : "k-navn").focus();
    return;
  }
  if(mail && mail.indexOf("@") < 1){ fejl("Tjek lige e-mailen — den ser ikke rigtig ud."); $("k-mail").focus(); return; }
  $("k-fejl").classList.remove("show");

  var y = state.ydelse, i = interval();
  var qty = mængde();

  /* Lead-payload — samme kontrakt som den gamle motor, bare med én ydelse.
     freq:1 fordi besøgsfrekvensen aftales på opkaldet og ikke er kundens valg. */
  var payload = {
    name: navn, email: mail, phone: tlf,
    message: $("k-note").value.trim().slice(0, 2000),
    address: state.adresse,
    kundetype: state.kundetype,
    betaling: null,
    source: "tilbudsmotor2",
    services: [{
      id: y.id, navn: y.navn, wm: y.wm,
      qty: qty, enhed: y.enhed, freq: 1,
      pris: y.pris, erPakkevare: false
    }],
    estimat: {
      md: Math.round((i ? i.punkt : 0) / 12), snit: Math.round(i ? i.punkt : 0),
      aar: Math.round(i ? i.punkt : 0), aarBrutto: Math.round(i ? i.punkt : 0),
      rabatPct: 0, rabatKr: 0, visits: 1, count: 1
    }
  };
  if(state.kundetype === "erhverv"){
    var cvr = $("k-cvr").value.replace(/\D/g,"");
    if(cvr) payload.cvr = cvr;
  }

  var btn = $("bar-btn"), tekst = btn.textContent;
  btn.disabled = true; btn.textContent = "Sender…";

  fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(function(res){ if(!res.ok) throw new Error("HTTP " + res.status); return res.json().catch(function(){ return {}; }); })
  .then(function(data){
    pushLead(y, i, qty);
    var ring = $("tak-ring"), t = ringTekst(data && data.call);
    ring.textContent = t; ring.hidden = !t;
    $("tak-opsum").innerHTML =
      "<b>" + esc(y.navn) + "</b><br>" +
      esc(state.adresse) + "<br>" +
      (i ? "Anslået " + esc(intervalTekst()) + " pr. besøg" : "Pris aftales på opkaldet");
    ryd();
    visStep("step-tak");
  })
  .catch(function(){
    fejl("Vi kunne ikke sende din forespørgsel lige nu. Prøv igen om et øjeblik — eller ring til os.");
  })
  .finally(function(){ btn.disabled = false; btn.textContent = tekst; });
}

function fejl(t){ var e = $("k-fejl"); e.textContent = t; e.classList.add("show"); }

/* GA4-konvertering. Ingen persondata i dataLayer — kun beløb og hvad der er valgt. */
function pushLead(y, i, qty){
  try{
    var dl = (window.dataLayer = window.dataLayer || []);
    dl.push({
      event: "generate_lead",
      currency: "DKK",
      value: i ? Math.round(i.punkt) : 0,
      lead_source: "tilbudsmotor2",
      lead_kundetype: state.kundetype,
      lead_services_count: 1,
      items: [{
        item_id: y.id, item_name: y.navn, item_list_name: "Tilbudsmotor 2",
        price: y.pris == null ? 0 : y.pris, quantity: qty
      }]
    });
  }catch(e){}
}

/* "booked 2026-07-06T15:15:00" → "Vi ringer til dig i dag ca. kl. 15:15." */
function ringTekst(call){
  var m = /^booked (\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(call || "");
  if(!m) return "";
  var y = +m[1], mo = +m[2], d = +m[3], klok = m[4] + ":" + m[5];
  var nu = new Date(), imorgen = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()+1);
  var erDag = function(dt){ return dt.getFullYear() === y && dt.getMonth()+1 === mo && dt.getDate() === d; };
  var DAGE = ["søndag","mandag","tirsdag","onsdag","torsdag","fredag","lørdag"];
  var dag = erDag(nu) ? "i dag" : erDag(imorgen) ? "i morgen" : "på " + DAGE[new Date(y, mo-1, d).getDay()];
  return "Vi ringer til dig " + dag + " ca. kl. " + klok + ".";
}

/* ============ GENDAN ============ */
(function gendan(){
  var s = null;
  try{ s = JSON.parse(sessionStorage.getItem(NØGLE) || "null"); }catch(e){ return; }
  if(!s || Date.now() - (s.t||0) > 3600e3) return;
  var y = YDELSER.filter(function(x){ return x.id === s.ydelse; })[0];
  if(!y) return;

  state.ydelse = y;
  state.baandIdx = typeof s.baandIdx === "number" ? s.baandIdx : 1;
  state.adresse = s.adresse || "";
  if(s.kundetype === "erhverv"){ state.kundetype = "erhverv"; $("kt-erhverv").click(); }

  $("omfang-titel").textContent = y.spg || "Hvor skal vi komme hen?";
  $("omfang-ydelse").textContent = y.kort;
  byggOmfang();
  if(state.adresse){ adrInput.value = state.adresse; hentFoto(state.adresse); }
  if(s.step === "step-kontakt" && state.adresse) visKontakt();
  else if(TRIN.indexOf(s.step) > -1) visStep(s.step, true);
})();

/* Sitedækkende kundetype (samme nøgle som kundetype.js og den gamle motor). */
(function(){
  try{ if(localStorage.getItem("kt-kundetype-v1") === "erhverv") $("kt-erhverv").click(); }catch(e){}
})();

opdaterBar("step-ydelse");

})();
