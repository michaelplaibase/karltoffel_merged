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
  /* ---- De mest valgte services (ikke forudvalgt — kunden vælger selv) ---- */
  {id:"vinduer",  navn:"Udvendig vinduesvask",       enhed:"glas",       pris:17.00, note:"Udvendige døre, vinduer og porte",                 qty:0,   freq:8,  fmax:12, on:false, pakke:true, kat:"pakke", wm:"Udvendig vinduesvask pr glas"},
  /* Hæk: TRIMNING 27,00 kr/m (hæk under 220 cm) — BESKÆRING (skære ind,
     vokset sig for stor) 33,50 kr/m. Prisen afledes af hæk-spørgsmålene
     (state.haekInfo, se syncHaekPris). wm-navnene er UÆNDREDE (samme
     WorkMaker-produkt for begge priser indtil nyt produkt findes i CSV). */
  {id:"haek",     navn:"Hækklipning",                    enhed:"m hæk",      pris:27.00, note:"Trimning — hæk under 220 cm",            qty:0,  freq:1,  fmax:3,  on:false, pakke:true, kat:"pakke", wm:"Hækklipning 1 side pr meter Under 220 cm"},
  {id:"green",    navn:"Greenkeeper græspleje",          enhed:"m² plæne",   pris:2.30,  note:"Gødning og pleje af plænen",      qty:0, freq:3,  fmax:6,  on:false, pakke:true, kat:"pakke", wm:"Greenkeeper græspleje"},
  {id:"alge",     navn:"Algebehandling af tag",          enhed:"m² tag",     pris:9.80,  min:950,  note:"Mos og alger, beregnet på skråt tagareal", qty:0, freq:1, fmax:2, on:false, pakke:true, kat:"pakke", wm:"Algebehandling af tag"},
  {id:"tagrender",navn:"Tagrenderens",                   enhed:"m tagrende", pris:18.00, note:"Stueplan / 1-plans hus",          qty:0,  freq:1,  fmax:2,  on:false, pakke:true, kat:"pakke", wm:"Tagrenderens Stueplan / 1-plans hus"},

  /* ---- Tilvalg: "Vi tilbyder også" (off som standard, gruppe = kat) ---- */
  {id:"ukrudt_sproejt", navn:"Sprøjtning af ukrudt mellem belægning", enhed:"m² fliser", pris:1.50, min:150, note:"Vi holder fugerne rene", qty:0, freq:5, fmax:8, on:false, pakke:false, kat:"groen", wm:"Ukrudt bekæmpelse på belægningsarealer"},
  {id:"ukrudt_fjern", navn:"Fjernelse af ukrudt mellem belægning", enhed:"m² fliser", pris:4.00, note:"Manuel fjernelse af ukrudt — hvis det er fjernet indenfor den sidste måned", qty:0, freq:5, fmax:8, on:false, pakke:false, kat:"groen", wm:null},
  {id:"beskaering",navn:"Beskæring af buske, træer og planter",   enhed:"træer",     pris:250.00, note:"Små træer/frugttræer — større træer efter besøg", qty:0, freq:1, fmax:2, on:false, pakke:false, kat:"groen", prisEnh:"træ", wm:"Beskæring Små træer / Frugttræer"},
  {id:"vinduerind",navn:"Vinduespudsning indeni huset",            enhed:"glas",      pris:24.87,  note:"Indvendige døre, vinduer og porte", qty:0,   freq:1,  fmax:6,  on:false, pakke:false, kat:"vinduer", wm:"Indendørs vinduespudsning pr glas"},
  {id:"solcelle",  navn:"Solcellevask",                           enhed:"paneler",   pris:40.00,  note:"Solcellepaneler på taget",          qty:0,   freq:1,  fmax:4,  on:false, pakke:false, kat:"vinduer", prisEnh:"panel", wm:"Solcellevask pr panel"},
  {id:"drivhus",   navn:"Drivhusvask",                            enhed:"gang",      pris:100.00, note:"Fast pris pr. gang — så er drivhuset vasket", qty:0, freq:1,  fmax:2,  on:false, pakke:false, kat:"vinduer", wm:"Drivhusvask — fast pris pr. gang"},
  {id:"algeflis",  navn:"Algebehandling af belægning",            enhed:"m² fliser", pris:7.80,   min:850, note:"Alger på fliser, terrasse og indkørsel", qty:0, freq:1, fmax:2, on:false, pakke:false, kat:"tag", wm:"Algebehandling af belægning"},
  {id:"fliserens", navn:"Fliserens",                              enhed:"",          pris:null,   note:"Dybderens med maskine — pris ved besøg", qty:0, freq:1, fmax:2, on:false, pakke:false, kat:"tag", wm:null},
  {id:"sammenriv", navn:"Sammenrivning & bortskaffelse af affald",enhed:"m² plæne",  pris:3.00,   note:"Åbne arealer / plæne",    qty:0, freq:1,  fmax:4,  on:false, pakke:false, kat:"affald",  wm:"Opsamling af løvfald til efteråret Åbne arealer / Græsplæne"},

  /* ---- Skadedyr ---- */
  {id:"myre_ude",   navn:"Myrebekæmpelse, udvendig sokkelbehandling", enhed:"gang", pris:935.00,  note:"Standard parcelhus",              qty:0, freq:1, fmax:2, on:false, pakke:false, kat:"skadedyr", wm:"Myrebekæmpelse udvendig sokkelbehandling"},
  {id:"myre_inde",  navn:"Myrebekæmpelse, indvendig behandling",      enhed:"gang", pris:650.00,  note:"Standard parcelhus",              qty:0, freq:1, fmax:2, on:false, pakke:false, kat:"skadedyr", wm:"Myrebekæmpelse indvendig behandling"}
];
/* Uberørt kopi til at nulstille pakken når en ny adresse vælges. */
const DEFAULTS = PRODUCTS.map(function(p){ return Object.assign({}, p); });

/* ============ Geografi: vi kører KUN i Jylland (Kristian 2026-09-07) ============
   Officielle DAWA-postnumre for Fyn (73 stk.) og Sjælland (697 stk.,
   ekskl. Bornholm 3700-3799 — Bornholm er ikke Sjælland for vores vedkommende).
   Adresse med postnummer fra disse lister → venteliste-trinnet i stedet for
   tilbud-flowet (se vaelgAdresse / visVenteliste). Statisk liste — ingen
   server-opslag. */
const VENTELISTE_FYN = new Set([5000,5200,5210,5220,5230,5240,5250,5260,5270,5290,5300,5320,5330,5350,5370,5380,5390,5400,5450,5462,5463,5464,5466,5471,5474,5485,5491,5492,5500,5540,5550,5560,5580,5591,5592,5600,5601,5602,5603,5610,5620,5631,5642,5672,5683,5690,5700,5750,5762,5771,5772,5792,5800,5853,5854,5856,5863,5871,5874,5881,5882,5883,5884,5892,5900,5932,5935,5943,5953,5960,5965,5970,5985].map(Number));
const VENTELISTE_SJAELLAND = new Set([1050,1051,1052,1053,1054,1055,1056,1057,1058,1059,1060,1061,1062,1063,1064,1065,1066,1067,1068,1069,1070,1071,1072,1073,1074,1100,1101,1102,1103,1104,1105,1106,1107,1110,1111,1112,1113,1114,1115,1116,1117,1118,1119,1120,1121,1122,1123,1124,1125,1126,1127,1128,1129,1130,1131,1150,1151,1152,1153,1154,1155,1156,1157,1158,1159,1160,1161,1162,1164,1165,1166,1167,1168,1169,1170,1171,1172,1173,1174,1175,1200,1201,1202,1203,1204,1205,1206,1207,1208,1209,1210,1211,1212,1213,1214,1215,1216,1218,1219,1220,1221,1250,1251,1252,1253,1254,1255,1256,1257,1259,1260,1261,1263,1264,1265,1266,1267,1268,1270,1271,1300,1301,1302,1303,1304,1306,1307,1308,1309,1310,1311,1312,1313,1314,1315,1316,1317,1318,1319,1320,1321,1322,1323,1324,1325,1326,1327,1328,1329,1350,1352,1353,1354,1355,1356,1357,1358,1359,1360,1361,1362,1363,1364,1365,1366,1367,1368,1369,1370,1371,1400,1401,1402,1403,1406,1407,1408,1409,1410,1411,1412,1413,1414,1415,1416,1417,1418,1419,1420,1421,1422,1423,1424,1425,1426,1427,1428,1429,1430,1432,1433,1434,1435,1436,1437,1438,1439,1440,1441,1450,1451,1452,1453,1454,1455,1456,1457,1458,1459,1460,1461,1462,1463,1464,1465,1466,1467,1468,1470,1471,1472,1473,1550,1551,1552,1553,1554,1555,1556,1557,1558,1559,1560,1561,1562,1563,1564,1567,1568,1569,1570,1571,1572,1573,1574,1575,1576,1577,1600,1601,1602,1603,1604,1605,1606,1607,1608,1609,1610,1611,1612,1613,1614,1615,1616,1617,1618,1619,1620,1621,1622,1623,1624,1631,1632,1633,1634,1635,1650,1651,1652,1653,1654,1655,1656,1657,1658,1659,1660,1661,1662,1663,1664,1665,1666,1667,1668,1669,1670,1671,1672,1673,1674,1675,1676,1677,1699,1700,1701,1702,1703,1704,1705,1706,1707,1708,1709,1710,1711,1712,1714,1715,1716,1717,1718,1719,1720,1721,1722,1723,1724,1725,1726,1727,1728,1729,1730,1731,1732,1733,1734,1735,1736,1737,1738,1739,1749,1750,1751,1752,1753,1754,1755,1756,1757,1758,1759,1760,1761,1762,1763,1764,1765,1766,1770,1771,1772,1773,1774,1775,1777,1799,1800,1801,1802,1803,1804,1805,1806,1807,1808,1809,1810,1811,1812,1813,1814,1815,1816,1817,1818,1819,1820,1822,1823,1824,1825,1826,1827,1828,1829,1850,1851,1852,1853,1854,1855,1856,1857,1860,1861,1862,1863,1864,1865,1866,1867,1868,1870,1871,1872,1873,1874,1875,1876,1877,1878,1879,1900,1901,1902,1903,1904,1905,1906,1908,1909,1910,1911,1912,1913,1914,1915,1916,1917,1920,1921,1922,1923,1924,1925,1926,1927,1928,1950,1951,1952,1953,1954,1955,1956,1957,1958,1959,1960,1961,1962,1963,1964,1965,1966,1967,1970,1971,1972,1973,1974,2000,2100,2150,2200,2300,2400,2450,2500,2600,2605,2610,2620,2625,2630,2635,2640,2650,2660,2665,2670,2680,2690,2700,2720,2730,2740,2750,2760,2765,2770,2791,2800,2820,2830,2840,2850,2860,2870,2880,2900,2920,2930,2942,2950,2960,2970,2980,2990,3000,3050,3060,3070,3080,3100,3120,3140,3150,3200,3210,3220,3230,3250,3300,3310,3320,3330,3360,3370,3390,3400,3450,3460,3480,3490,3500,3520,3540,3550,3600,3630,3650,3660,3670,4000,4030,4040,4050,4060,4070,4100,4130,4140,4160,4171,4173,4174,4180,4190,4200,4220,4230,4241,4242,4243,4244,4245,4250,4261,4262,4270,4281,4291,4293,4295,4296,4300,4305,4320,4330,4340,4350,4360,4370,4390,4400,4420,4440,4450,4460,4470,4480,4490,4500,4520,4532,4534,4540,4550,4560,4571,4572,4573,4581,4583,4591,4592,4593,4600,4621,4622,4623,4632,4640,4652,4653,4654,4660,4671,4672,4673,4681,4682,4683,4684,4690,4700,4720,4733,4735,4736,4750,4760,4771,4772,4773,4780,4791,4792,4793,4800,4840,4850,4862,4863,4871,4872,4873,4874,4880,4891,4892,4894,4895,4900,4912,4913,4920,4930,4941,4942,4943,4944,4945,4951,4952,4953,4960,4970,4983,4990].map(Number));
const VENTELISTE_POSTNR = new Set([...VENTELISTE_FYN, ...VENTELISTE_SJAELLAND]);

/* ============ Serviceside-kontekst (tilbudsmotoren indlejret på ydelsessider) ============
   Sider der indlejrer motoren sætter window.KARLTOFFEL.tilbudsmotorPage =
   { service: "<produkt-id eller null>", source: "<slug>" } FØR tilbudsmotor.js loades.
   Konsekvens: produktet forudvælges (on=true) første gang løsning-trinnet nås
   (medmindre kunden selv har rørt det), payload.source blir 'tilbudsmotor-<slug>'
   og Meta content_name blir '<slug>-motor' i stedet for 'tilbudsmotor-forside'.
   På forsiden er config ikke sat — alt opfører sig præcis som før. */
const TM_PAGE = (window.KARLTOFFEL && window.KARLTOFFEL.tilbudsmotorPage) || null;
const TM_PAGE_PRODUCT = (TM_PAGE && TM_PAGE.service) ? PRODUCTS.find(p => p.id === TM_PAGE.service) || null : null;
const TM_PAGE_SOURCE = TM_PAGE && TM_PAGE.source ? "tilbudsmotor-" + TM_PAGE.source : "tilbudsmotor";
const TM_CONTENT_NAME = TM_PAGE && TM_PAGE.source ? TM_PAGE.source + "-motor" : "tilbudsmotor-forside";
let tmPagePreselectDone = false;
function tmPagePreselect(){
  if(tmPagePreselectDone || !TM_PAGE_PRODUCT || TM_PAGE_PRODUCT.touched) return;
  tmPagePreselectDone = true;
  TM_PAGE_PRODUCT.on = true;
}

/* Prisen er bare en sum: hver valgt service lægges til, og det er det.
   Ingen regning pr. besøg, ingen snit — det tal kunderne spurgte til.
   total    = én besøgs-runde (sum af max(pris*qty, min))
   yearTotal= samme linjer ganget med freq (besøg/år) — det ÅRLIGTE estimat,
              der vises i sticky/linjer/tak-side og sendes til GTM/leadet. */
function beregn(products){
  var total = 0, yearTotal = 0, count = 0;
  for (var i=0;i<products.length;i++){
    var p = products[i];
    if(!p.on) continue;
    count += 1;                                   /* uprisede ("indeholdt") tæller også med */
    /* Hæk før højde er besvaret: ingen konkret meterpris i totalen endnu
       (fix 6) — rækken viser neutral note, beløbet rulles ind ved svar. */
    if(p.id === "haek" && !(state.haekInfo && state.haekInfo.hoejde)) continue;
    if(p.pris != null && p.qty > 0){
      var linje = Math.max(p.pris * p.qty, p.min || 0);
      total += linje;
      yearTotal += linje * p.freq;
    }
  }
  /* Hækkens udkørsels-TILVALG (Kristian 2026-09-09): 500 kr lægges kun i,
     når kunden HAR svaret Ja på "Skal vi køre klippet på lossepladsen?" —
     IKKE længere automatisk med som fast post. Ingen forudvælg: intet svar
     = ingen gebyr-linje. Gælder også når hækken er over 2,2 m (pris:null)
     — gebyret afholdes stadig pr. hæk-besøg når ja er valgt. */
  const haek = products.find(p => p.id === "haek");
  if(haek && haek.on && state.haekInfo && state.haekInfo.udkoersel === "Ja"){
    total += HAEK_UDKOERSEL;
    yearTotal += HAEK_UDKOERSEL * haek.freq;
  }
  return { total: total, yearTotal: yearTotal, count: count };
}
/* Fastede hæk-beløb (kr). */
const HAEK_UDKOERSEL = 500;
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
  /* Hæk-spørgsmålene (trin 4): kundens egne svar uden forvalg.
     sidstKlippet + hoejde + sider + arbejde + udkoersel — styrer hækkens pris
     (syncHaekPris). udkoersel = tilvalg (Kristian 2026-09-09): intet svar =
     ingen 500-kr-gebyr. */
  haekInfo: { sidstKlippet:"", hoejde:"", sider:"", arbejde:"", udkoersel:"" },
  ejendom: { type:"Villa, 1 fam.", grund:"827 m²", opfoert:"2007", haek:"65 m" }
};

/* ============ HÆK-SPØRGSMÅL + PRISAFLEDNING ============ */
/* Kundevenlige spørgsmål på hæk-rækken (ingen forvalg). Priser:
   TRIMNING 27,00 kr/m · BESKÆRING (skære ind, vokset sig for stor) 33,50 kr/m.
   "Inden for det seneste år" → forudvælg trimning; "Mere end et år siden" →
   beskæring; "Ved ikke" → følg arbejdes-svaret. Arbejde-svaret vinder ALTID
   over forudvalget. Over 2,2 m → pris:null-mønsteret (tæller 0 kr): vi ringer
   til kunden og beder om et billede af hækken (Kristian 2026-09-09).
   Udkørsel (500 kr) ligger i beregn(). */
const HAEK_SP = {
  sidstKlippet: { q:"Hvornår blev hækken klippet sidst?", opts:["Inden for det seneste år","Mere end et år siden","Ved ikke"] },
  hoejde:       { q:"Hvor høj er hækken?",               opts:["Under 1,5 m","1,5–2,2 m","Over 2,2 m","Ved ikke"] },
  sider:        { q:"Hvad skal der klippes?",            opts:["Indersider og top","2 sider og top","Flere forskellige — vi tjekker på luftfoto"] },
  arbejde:      { q:"Skal hækken bare trimmes, eller skal den skæres ind?", opts:["Bare en trimning — den skal se pæn ud","Den er vokset sig for stor og skal skæres ind"] }
};
const HAEK_HOEJDE_UKENDT_TXT = "Over 2,2 m — vi ringer til dig og beder om et billede af hækken, så vi kan give dig et præcist tilbud";
function syncHaekPris(){
  const h = PRODUCTS.find(p => p.id === "haek");
  if(!h) return;
  const info = state.haekInfo || {};
  if(info.hoejde === "Over 2,2 m"){
    /* Over 2,2 m: ingen automatisk sum — pris:null-mønsteret, tæller 0 kr. */
    h.pris = null;
    h.prisNote = HAEK_HOEJDE_UKENDT_TXT;
    h.haekBeskaering = false;
  } else {
    let beskaering = false;   /* svar (d) vinder ALTID over forudvalget */
    if(info.arbejde) beskaering = (info.arbejde === HAEK_SP.arbejde.opts[1]);
    else if(info.sidstKlippet === HAEK_SP.sidstKlippet.opts[1]) beskaering = true;
    else if(info.sidstKlippet === HAEK_SP.sidstKlippet.opts[0]) beskaering = false;
    h.pris = beskaering ? 33.50 : 27.00;
    h.note = beskaering ? "Beskæring — skæres ind (vokset sig for stor)" : "Trimning — hæk under 220 cm";
    h.haekBeskaering = beskaering;
    delete h.prisNote;
  }
}

/* UX-fixes 2026-09-09 (Kristian, 3. runde):
   - haekUsikker(): hæk er valgt, men højden er enten ikke svaret endnu eller
     "Over 2,2 m" (personligt tilbud). Bruges af betalingskortet ("—" i stedet
     for et vildledende 500-kr-tal) og af sticky/tak-side noterne.
   - Fradraget bortfalder ALDRIG (Kristian: "Drop det der med at skrive at
     fradraget bortfalder. Det passer ikke."): fradraget vises NORMALT i det
     godkendte format på det total, der ER i totalen — også når kun 500-gebyret
     er med (totalen ville ellers være 0), og i blandet kurv. Ingen strihning
     af gebyret ud af fradragsgrundlaget. */
function haekUsikker(){
  const h = PRODUCTS.find(p => p.id === "haek");
  return !!(h && h.on && (!state.haekInfo.hoejde || state.haekInfo.hoejde === "Over 2,2 m"));
}
function haekGebyrAar(){
  const h = PRODUCTS.find(p => p.id === "haek");
  /* Kun når tilvalget er svaret Ja — ellers er gebyret ikke i totalen. */
  return (h && h.on && state.haekInfo && state.haekInfo.udkoersel === "Ja") ? HAEK_UDKOERSEL * h.freq : 0;
}


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

/* Runde 4: geotiff.min.js + skraafoto.js indlæses nu lazy, første gang
   luftfoto-trinnet (step-verify) skal rendere — tidligere blev de hentet på
   alle 24 sider. Logikken er uændret; blot ventes der på scriptsne først. */
let luftfotoPromise = null;
function loadLuftfoto(){
  if(window.KARLTOFFEL && window.KARLTOFFEL.skraafotoRender) return Promise.resolve();
  if(luftfotoPromise) return luftfotoPromise;
  luftfotoPromise = new Promise(function(res, rej){
    const s1 = document.createElement("script");
    s1.src = "/assets/js/vendor/geotiff.min.js";
    s1.onload = function(){
      const s2 = document.createElement("script");
      s2.src = "/assets/js/skraafoto.js?v=12";
      s2.onload = function(){ res(); };
      s2.onerror = function(){ rej(new Error("skraafoto.js kunne ikke hentes")); };
      document.head.appendChild(s2);
    };
    s1.onerror = function(){ rej(new Error("geotiff.min.js kunne ikke hentes")); };
    document.head.appendChild(s1);
  });
  return luftfotoPromise;
}
function renderSkraafoto(dir){
  const badge = document.getElementById("sf-badge");
  const klar = window.KARLTOFFEL && window.KARLTOFFEL.skraafotoRender;
  if(!klar && badge) badge.textContent = "Henter luftfoto \u2026";   /* synlig tilstand mens scripts hentes */
  loadLuftfoto().then(function(){
    if(window.KARLTOFFEL && window.KARLTOFFEL.skraafotoRender){
      window.KARLTOFFEL.skraafotoRender(state.adresse, dir);
    }
  }).catch(function(err){ console.warn("Luftfoto kunne ikke indlæses:", err); if(badge) badge.textContent = ""; });
}

/* Auto-mål (nDSM): Kristian 2026-09-09 — ALLE felter skal kunden selv skrive
   i. Auto-målingen forudfylder IKKE længere nogen mængder; state.ejendom
   opdateres stadig (vist i ejendoms-trinnet), men qty felterne starter tomme
   ("Pris efter antal") indtil kunden taster selv. */
function applyMeasurements(m){
  if(!m) return;
  state.maal = m;
  const m2 = (v)=> DKK0.format(v) + " m²";
  if(m.grundAreal) state.ejendom.grund = m2(m.grundAreal);
  if(m.haekLangde) state.ejendom.haek = DKK0.format(m.haekLangde) + " m";
  /* Kristian 2026-09-09: INGEN auto-forudfyldning — kunden taster selv alle
     mængder (put()-kaldene er fjernet). Kun tagrenderens 2-plans-tier styres
     stadig af målingen (det er en pris, ikke en mængde). */
  /* Hæk-tiers (27,50/38,50) er UDGAET: hækkens pris styres nu af
     kundens egne svar i hæk-spørgsmålene (syncHaekPris) — auto-målingen
     forudfylder kun meter-antallet ovenfor. */
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
  tmPagePreselectDone = false;   /* ny adresse → forudvælg servicesidens ydelse igen */
  state.maal = null;
  state.haekInfo = { sidstKlippet:"", hoejde:"", sider:"", arbejde:"", udkoersel:"" };
  syncHaekPris();                /* tilbage til standard: trimning 27,00 kr/m */
}

function vaelgAdresse(titel){
  state.adresse = titel;
  lukListe();
  adrInput.value = titel;
  /* Geografi-tjek (Kristian 2026-09-07): vi kører KUN i Jylland endnu.
     Sjælland + Fyn-postnummer → venteliste i stedet for tilbud-flowet. */
  const pnr = udtraekPostnr(titel);
  if(pnr !== null && VENTELISTE_POSTNR.has(pnr)){
    resetProducts();
    verifyDir = 0; setVerifyHint("");
    visVenteliste(titel, pnr);
    return;
  }
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
const STEP_NAMES = ["Hvor bor du?","Hvem gør vi det for?","Din ejendom","Hvad skal vi hjælpe med?","Hvem skal vi ringe til?"];

/* skipScroll: ved stille gendannelse (persistens) må siden ikke hoppe til
   sektionen eller stjæle fokus — kunden er måske landet øverst på forsiden. */
function visStep(id, skipScroll){
  ROOT.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  if(!skipScroll) ROOT.scrollIntoView({ block:"start", behavior:"auto" });
  if(id === "step-verify") $("verify-adr").textContent = state.adresse;
  if(id === "step-losning"){ tmPagePreselect(); renderTop(); }
  /* Fremdrift: "Trin N af 5" + dots (skjules på tak-trinnet). */
  const prog = $("tm-progress");
  if(prog){
    const idx = STEP_ORDER.indexOf(id);
    prog.classList.toggle("done", idx === -1);
    if(idx > -1){
      const tilbage = STEP_ORDER.length - idx - 1;
      $("tm-progress-txt").textContent = "Trin " + (idx+1) + " af " + STEP_ORDER.length + " — " + STEP_NAMES[idx] +
        (tilbage > 0 ? " · kun " + tilbage + (tilbage === 1 ? " trin" : " trin") + " tilbage" : " · sidste trin!");
      const dots = $("tm-progress-dots").children;
      for(let i=0;i<dots.length;i++) dots[i].classList.toggle("on", i <= idx);
      for(let i=0;i<dots.length;i++) dots[i].classList.toggle("done", i < idx);
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
/* Runde 2: autosave i localStorage (ikke sessionStorage) — kunden kan lukke
   fanen, skifte telefon eller komme tilbage i morgen og fortsætte, hvor hun
   slap. 14 dages udløb i gendan-lytten. */
function gemState(stepId){
  try {
    if(!state.adresse) return;
    const prod = {};
    PRODUCTS.forEach(p => { prod[p.id] = { on: p.on, qty: p.qty, freq: p.freq, touched: !!p.touched }; });
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      t: Date.now(), adresse: state.adresse, kundetype: state.kundetype, betaling: state.betaling, step: stepId, prod,
      rabatkode: state.rabatkode
    }));
  } catch(e){ /* private mode / kvote — persistens er best-effort */ }
}
function rydState(){ try { localStorage.removeItem(PERSIST_KEY); } catch(e){} }

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

/* Runde 2: rabatkode vises kun, når kunden spørger efter den. */
(function(){
  const t = document.getElementById("rk-toggle"), w = document.getElementById("rk-wrap");
  if(!t || !w) return;
  t.addEventListener("click", ()=>{
    const open = w.hidden;
    w.hidden = !open;
    t.setAttribute("aria-expanded", open ? "true" : "false");
    if(open){
      t.textContent = "Rabatkode";
      const i = document.getElementById("k-rabat");
      if(i) i.focus();
    } else {
      t.textContent = "Har du en rabatkode?";
    }
  });
})();

/* ============ BETALING — én samlet pris ============ */
/* Betalingsvalget er fjernet (fast pr. gang) — kortet er kun information,
   ikke et klik-mål. "Videre" skal derfor altid være aktiv på dette trin;
   tidligere stod knappen disabled, indtil et kort blev klikket, hvilket
   ingen længere kunne — dermed frøs flowet her. */
const btTotal = $("bt-total"), lsVidere = $("ls-videre");
if(lsVidere) lsVidere.disabled = false;
function vaelgBetaling(t){
  state.betaling = t;
  if(lsVidere) lsVidere.disabled = false;
}

/* Pris-tekst på betalingskortet: det ÅRLIGTE estimat (freq ganget ind) —
   samme tal som sticky-totalens første del. */
function opdaterBetaling(){
  if(!btTotal) return;
  const r = beregn(PRODUCTS);
  /* Fix 2: KUN hæk-gebyret tilbage (højde ikke svaret / over 2,2 m) → intet
     konkret total-tal på betalingskortet endnu — 500 kr må ikke ligne en pris. */
  if(haekUsikker() && r.yearTotal <= haekGebyrAar()){ btTotal.textContent = "—"; return; }
  btTotal.textContent = DKK0.format(Math.round(r.yearTotal));
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
/* Fix 1 (UX 2026-09-08): når Hækklipning er valgt, er "Hvor høj er hækken?"
   PÅKRÆVET — det er det eneste spørgsmål der ændrer prisen. Ubesvaret
   "Videre"-klik blokeres, hæk-sektionen rulles op, og en kort venlig besked
   vises (samme err-mønster som kontakt-trinnet). De andre 3 spørgsmål
   forbliver valgfrie — "Ved ikke"-mulighederne fanger usikre kunder. */
$("ls-videre").addEventListener("click", ()=>{
  const hp = PRODUCTS.find(p=>p.id==="haek");
  if(hp && hp.on && !(state.haekInfo && state.haekInfo.hoejde)){
    const err = $("tm-haekinfo-err");
    if(err) err.classList.add("show");
    const hsec = $("tm-haekinfo");
    if(hsec) hsec.scrollIntoView({ block:"center", behavior:"smooth" });
    return;                       /* bloker videreklik */
  }
  if(state.betaling) visStep("step-kontakt");
});
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

/* ============ VENTELISTE (Sjælland/Fyn — vi kører der endnu ikke) ============ */
/* Kristian 2026-09-07: Karltoffel dækker kun Jylland. Kunde med Sjælland-/
   Fyn-adresse får venteliste-trinnet i stedet for tilbud-flowet og skrives op
   med navn + e-mail ELLER telefon (samme regel som lead-ruten kræver). */
function udtraekPostnr(t){
  const m = String(t).match(/\b(\d{4})\b/g);
  return m ? parseInt(m[m.length - 1], 10) : null;
}
/* "Sundvej 8, Gl Kalvehave, 4771 Kalvehave" → "4771 Kalvehave" (sidste postnr + by). */
function udtraekPostnrBy(t){
  const m = String(t).match(/(\d{4}(?:\s+[^,]+)?)\s*$/);
  return m ? m[1].trim() : String(t);
}
function visVenteliste(titel, pnr){
  measureReq++;                                   /* afbryd evt. påbegyndt auto-måling */
  const pnrTxt = udtraekPostnrBy(titel);
  $("v-postnr").textContent = "Dit postnummer: " + pnrTxt;
  $("v-postnr").hidden = false;
  $("v-form").hidden = false;
  $("v-ok").classList.remove("show");
  visStep("step-venteliste");
}
$("v-tilbage").addEventListener("click", ()=> visStep("step-adresse"));
$("v-send").addEventListener("click", ()=>{
  const navn = $("v-navn").value.trim(), mail = $("v-mail").value.trim(), tlf = $("v-tlf").value.trim();
  /* Samme regel som lead-ruten: navn + (e-mail ELLER telefon). */
  if(!navn || tlf.replace(/\D/g,"").length < 8 && (mail.indexOf("@") < 1)){
    sendFejlVenteliste("Udfyld dit navn — og din e-mail eller dit telefonnummer, så vi kan give dig besked.");
    return;
  }
  if(mail && mail.indexOf("@") < 1){
    sendFejlVenteliste("Tjek lige e-mailen — den ser ikke rigtig ud.");
    return;
  }
  $("v-err").classList.remove("show");
  const pnrTxt = udtraekPostnrBy(state.adresse);
  const payload = {
    name: navn, email: mail, phone: tlf,
    message: "Venteliste: postnummer " + pnrTxt,
    address: state.adresse,
    source: "venteliste"
  };
  const btn = $("v-send");
  btn.disabled = true;
  const btnTekst = btn.textContent;
  btn.textContent = "Sender...";
  fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => { if(!res.ok) throw new Error("HTTP " + res.status); return res.json().catch(()=>({})); })
  .then(()=>{
    $("v-form").hidden = true;
    $("v-ok").classList.add("show");
    rydState();                                   /* intet tilbud-flow at gendanne */
  })
  .catch(()=>{
    sendFejlVenteliste("Vi kunne ikke opskrive dig lige nu. Prøv igen om et øjeblik — eller ring til os.");
  })
  .finally(()=>{ btn.disabled = false; btn.textContent = btnTekst; });
});
function sendFejlVenteliste(t){ const e = $("v-err"); e.textContent = t; e.classList.add("show"); }


/* ============ URLPrefill: navn/telefon/adresse/postnummer fra simple formularer ============ */
/* Simple hero-formularer paa servicesider + landingsider er GET-forms med
   action="/#tilbudsmotor". Parameterne laeses her og forudfylder kontakt-
   trinnet + adressefeltet, saa kunden ikke skal skrive det hele to gange.
   Fejler stille — prefill maa aldrig blokere motoren. */
(function URLPrefill(){
  try {
    var q = new URLSearchParams(window.location.search);
    var navn = (q.get("navn") || "").trim();
    var tlf  = (q.get("telefon") || "").trim();
    var adr  = (q.get("adresse") || "").trim();
    var pnr  = (q.get("postnummer") || "").trim();
    if(!navn && !tlf && !adr && !pnr) return;
    if(!/^[a-zA-ZæøåÆØÅ .\-]{2,80}$/.test(navn)) navn = "";
    if(tlf.replace(/\D/g, "").length < 8) tlf = "";
    var samlet = [adr, pnr].filter(Boolean).join(", ");
    if(samlet && adrInput){ adrInput.value = samlet; state.adresse = samlet; }
    var nIn = $("k-navn"), tIn = $("k-tlf");
    if(navn && nIn && !nIn.value) nIn.value = navn;
    if(tlf && tIn && !tIn.value) tIn.value = tlf;
  } catch(e) {}
})();

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
  const totalNet = r.total * (1 - kodePct/100);        /* pr. besøg, netto */
  const yearNet = r.yearTotal * (1 - kodePct/100);     /* ÅRLIGT netto estimat (freq ganget ind) */
  /* Fix 1 (2026-09-09, Kristian): skattefradraget bortfalder ALDRIG — vises
     NORMALT på det årlige netto-estimat i det godkendte format, også når
     kun 500-gebyret er med (over 2,2 m) eller i blandet kurv. Ingen
     strihning af gebyret ud af grundlaget. */
  const fradrBase = yearNet;

  /* Lead-payload til CRM'et: kontaktinfo + valgte services (med WorkMaker-
     nøgle under overgangen) + estimat + kundetype. Sendes via sitets relay
     (/api/lead) — secret'en bor på serveren, aldrig i browseren. */
  const servicesArr = [];
  valgt.forEach(p=>{
    const s = { id:p.id, navn:p.navn, wm:p.wm, qty:p.qty, enhed:p.enhed, freq:p.freq, pris:p.pris, erPakkevare:p.pakke };
    if(p.id === "haek"){
      /* Beskæring sendes midlertidigt med samme wm (nyt produkt afventes i
         CSV) — note i leadet så teamet kan se, at 33,50 kr/m gælder. */
      s.haekInfo = {
        sidstKlippet: state.haekInfo.sidstKlippet || "Ikke besvaret",
        hoejde: state.haekInfo.hoejde || "Ikke besvaret",
        sider: state.haekInfo.sider || "Ikke besvaret",
        arbejde: state.haekInfo.arbejde || "Ikke besvaret",
        udkoersel: state.haekInfo.udkoersel || "Ikke besvaret"
      };
      if(state.haekInfo.hoejde === "Over 2,2 m") s.note = HAEK_HOEJDE_UKENDT_TXT;
      else if(p.haekBeskaering) s.note = "Beskæring (skæres ind) — 33,50 kr/m, sendes med samme WM-produkt indtil videre";
      /* Udkørsels-tilvalget: haek_udkoersel-post KUN ved Ja (Kristian 2026-09-09). */
      if(state.haekInfo.udkoersel === "Ja"){
        servicesArr.push({ id:"haek_udkoersel", navn:"Udkørsel og fjernelse af klip", wm:null, qty:1, enhed:"", freq:p.freq, pris:HAEK_UDKOERSEL, erPakkevare:false });
      }
    }
    servicesArr.push(s);
  });
  const payload = {
    name: navn, email: mail, phone: tlf,
    message: $("k-note").value.trim().slice(0, 2000),   /* server-cap er 2000 — klip lokalt så relayets 9 KB-grænse aldrig rammes */
    address: state.adresse,
    kundetype: state.kundetype,
    betaling: state.betaling,
    source: TM_PAGE_SOURCE,
    services: servicesArr,
    estimat: { total: Math.round(yearNet), count: r.count }   /* årligt netto estimat */
  };
  /* Meta CAPI-dedup: tilfældig event_id deles mellem browser-pixelens
     fbq('track') og CRM'ets server-side Conversions API-kald, så Meta tæller
     konverteringen én gang. Se lib/meta-capi.ts i CRM'et. */
  const metaEventId = (window.crypto && typeof window.crypto.randomUUID === "function")
    ? window.crypto.randomUUID()
    : "tm-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  payload.meta_capi = { event_id: metaEventId, content_name: TM_CONTENT_NAME };
  /* Hero-/landingformularer (servicesider) gemte deres eget Lead-event i
     sessionStorage — fragt det med som meta_capi_prior, så CAPI-eventet får
     samme content_name ('<slug>-hero' osv.) som browser-eventet. Ryddes
     først når leadet ER sendt (fejler forsøget, skal det overleve retry). */
  try {
    const pending = JSON.parse(window.sessionStorage.getItem("ktMetaPendingLead") || "null");
    if (pending && pending.event_id && pending.content_name) payload.meta_capi_prior = pending;
  } catch (e) {}
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
    pushLeadEvent(valgt, r, yearNet, kodePct);

    /* Meta Pixel: Lead-konvertering med unikt content_name, saa der kan
       oprettes custom conversions pr. formular i Meta. eventID matcher
       CAPI-kaldet (payload.meta_capi.event_id) — dedup i Meta. */
    try {
      if (typeof fbq === "function") {
        fbq("track", "Lead", { content_name: TM_CONTENT_NAME, content_type: "form", value: Math.round(yearNet), currency: "DKK" }, { eventID: metaEventId });
      }
    } catch (e) {}
    /* Prior-hero-eventet er nu fragtet sikkert til CRM'et — ryd det, så en
       senere tilbudsmotor-indsendelse ikke sender det samme event_id igen. */
    try { window.sessionStorage.removeItem("ktMetaPendingLead"); } catch (e) {}

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
        const suffix = (p.pris == null) ? (p.prisNote ? " (vi ringer til dig og beder om et billede af hækken)" : (p.pakke ? " (indeholdt)" : " (pris ved besøg)"))
                     : (!p.qty ? " (angiv antal)" : " (" + p.freq + "x/år)");
        return esc(p.navn) + suffix;
      });
      /* Udkørsels-tilvalget (Kristian 2026-09-09): 500-kr-linjen KUN når
         kunden har svaret Ja. Nej/intet svar → ingen linje. */
      if(valgt.some(p=>p.id === "haek") && state.haekInfo.udkoersel === "Ja"){
        const hae = valgt.find(p=>p.id === "haek");
        linjer.push("Udkørsel og fjernelse af klip (500 kr — fordi vores biler har gule nummerplader, koster det os 500 kroner at køre det på genbrugspladsen, " + hae.freq + "x/år)");
      }
      var kodeLinje = kodePct > 0 ? "Rabatkode anvendt: <b>−" + kodePct + "%</b><br>" : "";
      /* Fradrags-linjen på tak-siden (fix 1, 2026-09-09): vises ALTID når der
         er et beløb i totalen — også kun-gebyr-tilfælde (over 2,2 m). */
      let fradrLinje = "";
      if(fradrBase > 0){
        const f = Math.min(fradrBase * 0.26, 18300);
        fradrLinje = "Ca. " + kr(f) + "/år i skattefradrag (servicefradraget, 2026) — ≈ <b>" + kr(fradrBase - f) + "/år efter fradrag</b><br>";
      }
      /* Fix 2 (2026-09-09): hæk over 2,2 m → vi kontakter kunden om et billede. */
      let billedeLinje = "";
      if(valgt.some(p=>p.id === "haek") && state.haekInfo.hoejde === "Over 2,2 m"){
        billedeLinje = "Vi kontakter dig for at få tilsendt et billede af din hæk — så sender vi et præcist tilbud.<br>";
      }
      opsum.innerHTML =
        "<b>" + esc(state.adresse) + ktLabel + "</b><br>" +
        "Valgt: " + linjer.join(", ") + "<br>" +
        kodeLinje +
        billedeLinje +
        'Pr. besøg: <b><span id="tak-total" class="tm-anim-kr">' + kr(totalNet) + '</span></b>' +
        ' · <b><span id="tak-aar" class="tm-anim-kr">' + kr(yearNet) + '</span>/år</b><br>' +
        fradrLinje +
        'Estimat — endelig pris aftaler vi ved opkaldet';
      /* Tak-totalerne tæller blødt op fra 0 (count-animationen). */
      animateNumber(opsum.querySelector("#tak-total"), 0, totalNet, kr);
      animateNumber(opsum.querySelector("#tak-aar"), 0, yearNet, kr);
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
    lead_source: TM_PAGE_SOURCE,
    lead_kundetype: state.kundetype || "ukendt",
    lead_services_count: r.count,
    lead_value_total: Math.round(totalNet),
    lead_coupon_discount_pct: kodePct,
    items: valgt.map(function(p, i){
      const enhedspris = p.pris == null ? 0 : p.pris;
      /* Hæk før højde er besvaret: 0-kr linje, så items' sum matcher
         lead_value_total (beregn() tæller hæk-beløbet heller ikke endnu). */
      const linje = (p.pris == null || !(p.qty > 0) || (p.id === "haek" && !(state.haekInfo && state.haekInfo.hoejde))) ? 0 : Math.max(enhedspris * p.qty, p.min || 0);
      return {
        item_id: p.id,
        item_name: p.navn,
        item_category: p.kat,
        item_list_name: p.pakke ? "Mest valgte services" : "Tilvalg",
        index: i,
        price: enhedspris,
        quantity: p.qty,
        frequency_per_year: p.freq,
        item_revenue: Math.round(linje * p.freq)   /* årligt — summer op til lead_value_total */
      };
    })
  };
  /* Udkørsels-tilvalget: eget GTM-item KUN ved Ja (så items' sum matcher
     lead_value_total — beregn() lægger 500'eren kun i når Ja). */
  const hae = valgt.find(p => p.id === "haek");
  if(hae && state.haekInfo.udkoersel === "Ja"){
    ev.items.push({
      item_id: "haek_udkoersel",
      item_name: "Udkørsel og fjernelse af klip",
      item_category: hae.kat,
      item_list_name: "Mest valgte services",
      index: valgt.length,
      price: HAEK_UDKOERSEL,
      quantity: 1,
      frequency_per_year: hae.freq,
      item_revenue: Math.round(HAEK_UDKOERSEL * hae.freq)
    });
  }
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

/* Hvorfor spørger vi? Én kundevenlig linje pr. service — vises under navnet
   i trin 4, så det er tydeligt hvad Karltoffel laver med hver ydelse. */
const WM_HVORFOR = {
  vinduer: "Vi vasker dem udvendigt — antallet afgør, hvor lang tid et besøg tager.",
  haek: "Vi klipper hækken og fejer efter — svar spørgsmålene under rækken, så prisen rammer rigtigt.",
  green: "Vi gøder og plejer plænen, så den holder sig grøn hele sæsonen.",
  alge: "Vi fjerner mos og alger på taget, så taget holder længere — arealet afgør prisen.",
  tagrender: "Vi renser blade og mudder ud, så vandet løber fra huset — længden i meter er nok.",
  ukrudt_sproejt: "Vi sprøjter ukrudtet mellem fliserne, så fugerne holder sig rene.",
  ukrudt_fjern: "Vi trækker ukrudtet ud i hånden — skånsomt og uden sprøjtemidler. Gælder hvis ukrudtet er fjernet indenfor den sidste måned.",
  beskaering: "Vi beskærer buske og træer og fjerner grenaffaldet.",
  vinduerind: "Vi pudser vinduerne indvendigt — antallet afgør, hvor lang tid det tager.",
  solcelle: "Vi vasker panelerne, så de giver mest mulig strøm.",
  drivhus: "Vi vasker drivhuset ind og ud — fast pris pr. gang.",
  algeflis: "Vi fjerner alger på fliser og terrasse, så de bliver pæne og skridsikre.",
  fliserens: "Vi dybderenser fliserne med maskine — vi ser på det og giver pris, når vi er forbi.",
  sammenriv: "Vi fjerner det gamle lølag og efterlader en ren og jævn plæne.",
  myre_ude: "Vi behandler soklen udvendigt, så myrerne bliver udenfor.",
  myre_inde: "Vi behandler de steder inde, hvor myrerne kommer.",
};
const CAT_LABELS = { pakke:"Mest valgt", groen:"Grøn have", vinduer:"Vinduer & glas", tag:"Tag & fliser", affald:"Affald", vinter:"Vinter", skadedyr:"Skadedyrsbekæmpelse" };

/* ============ RUNDTUR I BOLIGEN: 3 kategorikort ============ */
/* Services grupperes efter hvor arbejdet foregår: i haven, uden på huset
   eller indendørs. Hvert produkt-id står i præcis ét kort. p.kat beholdes
   uændret (bruges af GTM item_category + tak-sidens logik) — kortene er kun
   en visnings-gruppering ovenpå den samme liste. */
const SERVICE_CARDS = [
  { key:"ude", emoji:"🏠", title:"På huset",
    ids:["vinduer","solcelle","drivhus","alge","tagrender","algeflis","fliserens","myre_ude"] },
  { key:"haven", emoji:"🌳", title:"I haven",
    ids:["green","haek","beskaering","ukrudt_sproejt","ukrudt_fjern","sammenriv"] },
  { key:"inde", emoji:"🛋️", title:"Indeni huset",
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
    box.className = "tm-card open";
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
    /* Alle 3 kort er altid åbne (Kristian 2026-09-04) — head er kun overskrift. */

    const body = document.createElement("div");
    body.className = "tm-card-body";
    body.id = "tm-card-body-" + card.key;
    items.forEach(p => {
      body.appendChild(byggRaekke(p));
      /* Hæk-spørgsmålene + udkørsels-linjen: egen lille sektion under hæk-rækken. */
      if(p.id === "haek") body.appendChild(byggHaekInfo());
    });

    box.appendChild(head); box.appendChild(body);
    wrap.appendChild(box);
  });
}

/* Sticky opsummeringslinje: "X ting valgt · Ét besøg klarer det hele · Y kr/år i alt · Z kr pr. besøg".
   Samme sum-beregning som overalt ellers (beregn) — live opdateret via opdater().
   Y = yearTotal (freq ganget ind), Z = total pr. besøgs-runde. */
function opdaterSticky(){
  const r = beregn(PRODUCTS);
  /* Fix 1 (2026-09-09, Kristian): fradraget bortfalder ALDRIG — det vises
     NORMALT i det godkendte format på det total, der ER i totalen. Er kun
     500-gebyret med (over 2,2 m / før højde-svar), beregnes fradraget på
     gebyrbeløbet (totalen ville ellers være 0). Ingen strihning af gebyret. */
  const usikker = haekUsikker();
  const cnt = $("tm-sticky-count"), tot = $("tm-sticky-total");
  if(cnt) cnt.textContent = r.count + " ting valgt";
  if(tot){
    const old = tot.dataset.v;
    let txt = kr(r.yearTotal) + "/år i alt · " + kr(r.total) + " pr. besøg";
    if(r.yearTotal > 0){
      const fradrTotal = Math.min(r.yearTotal * 0.26, 18300);
      txt += " · ca. " + kr(fradrTotal) + "/år i skattefradrag (≈ " + kr(r.yearTotal - fradrTotal) + "/år efter fradrag)";
    }
    if(usikker){
      txt += (state.haekInfo.hoejde === "Over 2,2 m")
        ? " — vi ringer til dig og beder om et billede af hækken, så vi kan give dig et præcist tilbud"
        : " — hækkens pris rammer vi, når højden er valgt";
    }
    tot.textContent = txt;
    /* Runde 2: kort pulse på beløbet når det ændrer sig — prisen skal mærkes. */
    if(old !== undefined && old !== String(r.yearTotal)){
      tot.classList.remove("tm-pulse");
      void tot.offsetWidth;                       /* reflow → animation genstarter */
      tot.classList.add("tm-pulse");
    }
    tot.dataset.v = String(r.yearTotal);
  }
  /* Pr. kort: antal valgte i hvert kort. */
  SERVICE_CARDS.forEach(card => {
    const el = ROOT.querySelector('[data-card-count="' + card.key + '"]');
    if(!el) return;
    const n = PRODUCTS.filter(p => p.on && card.ids.indexOf(p.id) > -1).length;
    el.textContent = n + " valgt";
  });
}

/* Ca.-mængde pr. ydelse: kunden taster selv antal på ALLE ydelser med konkret
   mængdeenhed (qw-input-mønsteret: numeric, min/max-klemme, p.touched).
   lbl = label + placeholder-tekst, max = øvre klemme pr. enhedstype.
   fliserens (pris:null, ingen enhed) får ikke felt. Auto-målet (skråfoto)
   forudfylder stadig felter kunden ikke selv har rørt — se applyMeasurements. */
const QTY_META = {
  vinduer:        { lbl:"Antal døre, vinduer og porte", ph:"f.eks. 12",  max:300 },
  vinduerind:     { lbl:"Antal døre, vinduer og porte", ph:"f.eks. 12",  max:300 },
  solcelle:       { lbl:"Antal paneler",                ph:"f.eks. 20",  max:300 },
  haek:           { lbl:"Ca. antal meter hæk",          ph:"f.eks. 65",  max:1000 },
  green:          { lbl:"Ca. antal m² plæne",           ph:"f.eks. 450", max:5000 },
  sammenriv:      { lbl:"Ca. antal m² plæne",           ph:"f.eks. 450", max:5000 },
  alge:           { lbl:"Ca. antal m² tag",             ph:"f.eks. 120", max:2000 },
  tagrender:      { lbl:"Ca. antal meter tagrende",     ph:"f.eks. 24",  max:500 },
  ukrudt_sproejt: { lbl:"Ca. antal m² belægning",       ph:"f.eks. 75",  max:2000 },
  ukrudt_fjern:   { lbl:"Ca. antal m² belægning",       ph:"f.eks. 60",  max:2000 },
  algeflis:       { lbl:"Ca. antal m² belægning",       ph:"f.eks. 60",  max:2000 },
  beskaering:     { lbl:"Antal træer",                  ph:"f.eks. 3",   max:50 },
  drivhus:        { lbl:"Antal drivhuse",               ph:"f.eks. 1",   max:10 },
  myre_ude:       { lbl:"Antal behandlinger",           ph:"f.eks. 1",   max:5 },
  myre_inde:      { lbl:"Antal behandlinger",           ph:"f.eks. 1",   max:5 },
};

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
  if(WM_HVORFOR[p.id]){
    navn.appendChild(document.createElement("br"));
    const hint = document.createElement("small");
    hint.className = "tm-hvorfor";
    hint.textContent = WM_HVORFOR[p.id];
    navn.appendChild(hint);
  }

  /* Ca.-mængde — kunden taster selv antal (QTY_META). Prisen er enhedsprisen
     ganget med det indtastede antal. Tomt felt = ingen pris endnu. */
  let qw = null;
  const qmeta = QTY_META[p.id];
  if(qmeta){
    qw = document.createElement("div");
    qw.className = "qw";
    const qlbl = document.createElement("span"); qlbl.className = "qw-lbl";
    qlbl.textContent = qmeta.lbl;
    const qin = document.createElement("input");
    qin.type = "number"; qin.id = "qty-" + p.id; qin.inputMode = "numeric";
    qin.min = "1"; qin.max = String(qmeta.max); qin.step = "1";
    qin.placeholder = qmeta.ph;
    qin.value = p.qty > 0 ? p.qty : "";
    qin.setAttribute("aria-label", qmeta.lbl + " til " + p.navn);
    qin.addEventListener("input", ()=>{
      const raw = qin.value.trim();
      if(raw === ""){ p.qty = 0; opdater(); return; }   /* tomt felt = vent på kunden */
      let v = Math.round(Number(raw));
      if(!isFinite(v) || v < 1) v = 1;
      if(v > qmeta.max) v = qmeta.max;
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

/* Hæk-sektionen under hæk-rækken: 4 kundevenlige spørgsmål (radio-mønster)
   + den faste udkørsels-linje (500 kr). Gen-bygges ved renderRows (trin-/
   adresse-skift) — valg markeres ud fra state.haekInfo. Klik → svar gemmes,
   prisen afledes (syncHaekPris) og tallene opdateres (opdater()). */
function byggHaekInfo(){
  const sec = document.createElement("div");
  sec.className = "tm-haekinfo" + (PRODUCTS.find(p=>p.id==="haek").on ? "" : " row--off");
  sec.id = "tm-haekinfo";
  Object.keys(HAEK_SP).forEach(key => {
    const sp = HAEK_SP[key];
    const blk = document.createElement("div");
    blk.className = "tm-haekinfo-q";
    const lbl = document.createElement("span");
    lbl.className = "tm-haekinfo-lbl";
    lbl.textContent = sp.q;
    blk.appendChild(lbl);
    const opts = document.createElement("div");
    opts.className = "tm-haekinfo-opts";
    opts.setAttribute("role", "radiogroup");
    opts.setAttribute("aria-label", sp.q);
    sp.opts.forEach(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tm-haekinfo-opt" + (state.haekInfo[key] === o ? " selected" : "");
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", state.haekInfo[key] === o ? "true" : "false");
      b.textContent = o;
      b.addEventListener("click", ()=>{
        state.haekInfo[key] = o;
        opts.querySelectorAll(".tm-haekinfo-opt").forEach(x=>{
          x.classList.toggle("selected", x === b);
          x.setAttribute("aria-checked", x === b ? "true" : "false");
        });
        if(key === "hoejde"){ const er = $("tm-haekinfo-err"); if(er) er.classList.remove("show"); }
        syncHaekPris();
        opdater();
      });
      opts.appendChild(b);
    });
    blk.appendChild(opts);
    sec.appendChild(blk);
  });
  /* Udkørsels-TILVALG (Kristian 2026-09-09): pænt spørgsmål med to valg,
     ingen forudvælgelse. Ja → 500 kr pr. hæk-besøg (beregn()); Nej → ingen
     gebyr-linje. Samme tone som Bud 2 (losseplads/genbrugsplads, gule
     nummerplader, 'du ikk' skal røre en finger'). */
  const udk = document.createElement("div");
  udk.className = "tm-haekinfo-q tm-haekinfo-udkoersel";
  udk.id = "tm-haekinfo-udkoersel";
  const udkLbl = document.createElement("span");
  udkLbl.className = "tm-haekinfo-lbl";
  udkLbl.textContent = "Skal vi køre klippet på genbrugspladsen?";
  udk.appendChild(udkLbl);
  const udkOpts = document.createElement("div");
  udkOpts.className = "tm-haekinfo-opts";
  udkOpts.setAttribute("role", "radiogroup");
  udkOpts.setAttribute("aria-label", "Skal vi køre klippet på genbrugspladsen?");
  const UDK_OPTS = [
    { v:"Ja",  t:"Ja tak — vi kører det grønne af sted, så du ikk' skal røre en finger (+ 500 kr i gebyr, fordi vores biler har gule nummerplader)" },
    { v:"Nej", t:"Nej tak — jeg kører det selv væk" }
  ];
  UDK_OPTS.forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tm-haekinfo-opt" + (state.haekInfo.udkoersel === o.v ? " selected" : "");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", state.haekInfo.udkoersel === o.v ? "true" : "false");
    b.textContent = o.t;
    b.addEventListener("click", ()=>{
      state.haekInfo.udkoersel = o.v;
      udkOpts.querySelectorAll(".tm-haekinfo-opt").forEach(x=>{
        x.classList.toggle("selected", x === b);
        x.setAttribute("aria-checked", x === b ? "true" : "false");
      });
      opdater();
    });
    udkOpts.appendChild(b);
  });
  udk.appendChild(udkOpts);
  sec.appendChild(udk);
  /* Fix 1: venlig påkrævet-besked (samme err-mønster som kontakt-trinnet).
     Vises kun ved blokeret "Videre"-klik uden højde-svar; en højde-valg fjerner den. */
  const err = document.createElement("div");
  err.className = "tm-haekinfo-err";
  err.id = "tm-haekinfo-err";
  err.textContent = "Vælg lige højden på din hæk — så rammer vi prisen bedre.";
  sec.appendChild(err);
  return sec;
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
  var kodeKr = r.yearTotal * kodePct / 100;   /* årligt — samme grundlag som de viste beløb */
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
  /* Hæk-sektionen (spørgsmål + udkørselslinje) følger hæk-tilvalget. */
  const hsec = $("tm-haekinfo"), hp = PRODUCTS.find(p=>p.id==="haek");
  if(hsec && hp) hsec.classList.toggle("row--off", !hp.on);
  PRODUCTS.forEach(p => {
    const el = ROOT.querySelector('.pw[data-id="' + p.id + '"]');
    if(!el) return;
    /* Fix 6 (UX 2026-09-08): hæk-rækken må IKKE vise et konkret pris-tal,
       før højden er valgt — neutral note (prisNote-mønsteret) indtil da.
       Efter højde-valg opdateres som normalt. */
    if(p.id === "haek" && p.on && !(state.haekInfo && state.haekInfo.hoejde)){
      el.innerHTML = '<span class="pw-note">Ca. 27,00 kr/m — afhængig af højde</span>';
      delete el.dataset.val;
      return;
    }
    if(p.pris == null){
      const langNote = p.prisNote ? " pw-note-lang" : "";
      el.innerHTML = '<span class="pw-note' + langNote + '">' + (p.prisNote || (p.pakke ? "Inkluderet — aftales ved opkald" : "Pris ved besøg")) + '</span>';
      delete el.dataset.val;
    } else if(!p.qty){
      el.innerHTML = '<span class="pw-note">Pris efter antal</span>';
      delete el.dataset.val;
    } else {
      const raw = p.pris * p.qty;
      const val = p.min ? Math.max(raw, p.min) : raw;    /* min-beløb gælder pr. besøg */
      const unitTxt = "pr. besøg · " + kr(val * p.freq) + "/år ved " + p.freq + " besøg";
      /* Servicefradrag 2026: 26% af arbejdsløn (inkl. moms), maks 18.300 kr/år pr. person. */
      const fradr = Math.min(val * p.freq * 0.26, 18300);
      const fradrTxt = "Ca. " + kr(fradr) + "/år i skattefradrag (≈ " + kr(val * p.freq - fradr) + "/år efter fradrag)";
      const prev = parseFloat(el.dataset.val);
      const b = el.querySelector(".pw-val");
      const u = el.querySelector(".pw-unit");
      let fEl = el.querySelector(".pw-fradrag");
      if(!b){   /* første visning: skriv direkte (ingen animation fra ingenting) */
        el.innerHTML = '<b class="pw-val">' + kr(val) + '</b><span class="pw-unit">' + unitTxt + '</span><small class="pw-fradrag">' + fradrTxt + '</small>';
      } else {
        if(isFinite(prev) && prev !== val) animateNumber(b, prev, val, kr);
        else b.textContent = kr(val);
        if(u) u.textContent = unitTxt;
        if(!fEl){ fEl = document.createElement("small"); fEl.className = "pw-fradrag"; el.appendChild(fEl); }
        fEl.textContent = fradrTxt;
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
  try { s = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null"); } catch(e){ return; }
  if(!s || !s.adresse || Date.now() - (s.t || 0) > 14 * 86400e3) return;
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
  /* Runde 2: fortæl kunden, at hendes valg overlevede — ingen forvirring. */
  const resume = document.createElement("p");
  resume.className = "tm-resume";
  resume.textContent = "Dine valg er gemt — fortsæt, hvor du slap.";
  const akt = $(s.step);
  if(akt && akt.querySelector(".topbar")) akt.querySelector(".topbar").after(resume);
  else if(akt) akt.prepend(resume);
  visStep(s.step, true);   /* stille: intet scroll-hop, ingen fokus-tyveri */
})();

})();
