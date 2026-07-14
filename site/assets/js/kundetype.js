/* ==========================================================================
   Karltoffel kundetype (privat/erhverv) — sitedækkende præference.
   Husker valget i localStorage under "kt-kundetype-v1" (ingen cookies),
   injicerer en Privat|Erhverv-switch i headeren på alle sider og viser en
   førstegangs-modal på forsiden, når intet valg er gemt endnu.
   Tilbudsmotoren læser og spejler samme nøgle (to-vejs-synk), og forsidens
   inline head-script sender huskede erhvervskunder direkte til /erhverv.
   Styling: /assets/css/kundetype.css (alt scopet under .kt-*).
   ========================================================================== */
(function(){
"use strict";

var KEY = "kt-kundetype-v1";

function laesValg(){
	try {
		var v = localStorage.getItem(KEY);
		return (v === "privat" || v === "erhverv") ? v : null;
	} catch(e){ return null; }
}
function gemValg(v){
	try { localStorage.setItem(KEY, v); } catch(e){ /* private mode — best effort */ }
}
/* Routing: privat bor på forsiden, erhverv på /erhverv (vercel-redirect → /p/erhverv). */
function gaaTil(v){ window.location.href = v === "erhverv" ? "/erhverv" : "/"; }

/* Samme hus/bygning-ikoner som tilbudsmotorens kundetype-kort (trin 2). */
var IKON = {
	privat:  '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 22 24 8l16 14" stroke="#FFF87B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 20v20h24V20" stroke="#FFF87B" stroke-width="3" stroke-linejoin="round"/><path d="M20 40V28h8v12" stroke="#FFF87B" stroke-width="3" stroke-linejoin="round"/></svg>',
	erhverv: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="10" y="8" width="20" height="32" stroke="#FFF87B" stroke-width="3" stroke-linejoin="round"/><path d="M30 18h8v22H10" stroke="#FFF87B" stroke-width="3" stroke-linejoin="round"/><path d="M16 15h3M21 15h3M16 21h3M21 21h3M16 27h3M21 27h3" stroke="#FFF87B" stroke-width="3" stroke-linecap="round"/></svg>'
};

/* ---- Header-switch: Privat | Erhverv (desktop-nav + mobil-drawer) ---- */
function byggSwitch(){
	var valgt = laesValg();
	var lister = document.querySelectorAll(".header .nav__items");
	for (var i = 0; i < lister.length; i++){
		var li = document.createElement("li");
		li.className = "nav__item nav__item--kundetype";
		var wrap = document.createElement("div");
		wrap.className = "kt-switch";
		wrap.setAttribute("role", "group");
		wrap.setAttribute("aria-label", "Privat eller erhverv");
		["privat", "erhverv"].forEach(function(t){
			var b = document.createElement("button");
			b.type = "button";
			b.className = "kt-switch__btn" + (valgt === t ? " is-active" : "");
			b.setAttribute("aria-pressed", valgt === t ? "true" : "false");
			b.setAttribute("data-kt", t);
			b.textContent = t === "privat" ? "Privat" : "Erhverv";
			b.addEventListener("click", function(){ gemValg(t); gaaTil(t); });
			wrap.appendChild(b);
		});
		li.appendChild(wrap);
		lister[i].appendChild(li);
	}
}

function opdaterSwitch(valgt){
	var btns = document.querySelectorAll(".kt-switch__btn");
	for (var i = 0; i < btns.length; i++){
		var aktiv = btns[i].getAttribute("data-kt") === valgt;
		btns[i].classList.toggle("is-active", aktiv);
		btns[i].setAttribute("aria-pressed", aktiv ? "true" : "false");
	}
}

/* ---- Førstegangs-modal på forsiden: "Privat eller erhverv?" ---- */
/* Privat: gem valget og luk (kunden bliver på forsiden). Erhverv: gem valget
   og videre til /erhverv. Genbruger ktype-kort-udtrykket fra tilbudsmotoren. */
function byggModal(){
	var modal = document.createElement("div");
	modal.className = "kt-modal";
	modal.setAttribute("role", "dialog");
	modal.setAttribute("aria-modal", "true");
	modal.setAttribute("aria-labelledby", "kt-modal-titel");

	var inner = document.createElement("div");
	inner.className = "kt-modal__inner";
	inner.innerHTML =
		'<h2 id="kt-modal-titel">Privat eller erhverv?</h2>' +
		'<p>Vælg hvem vi skal ordne det for — så viser vi dig det rigtige fra start.</p>';

	var cards = document.createElement("div");
	cards.className = "kt-modal__cards";
	[
		{ type: "privat",  titel: "Privat",  sub: "Villa, rækkehus eller sommerhus" },
		{ type: "erhverv", titel: "Erhverv", sub: "Virksomhed, udlejning eller forening" }
	].forEach(function(k){
		var b = document.createElement("button");
		b.type = "button";
		b.className = "kt-modal-card";
		b.innerHTML = IKON[k.type] + "<b>" + k.titel + "</b><small>" + k.sub + "</small>";
		b.addEventListener("click", function(){
			gemValg(k.type);
			if(k.type === "erhverv"){ window.location.href = "/erhverv"; return; }
			opdaterSwitch(k.type);
			if(modal.parentNode) modal.parentNode.removeChild(modal);
		});
		cards.appendChild(b);
	});
	inner.appendChild(cards);
	modal.appendChild(inner);
	document.body.appendChild(modal);
	var first = cards.querySelector("button");
	if(first) first.focus();
}

byggSwitch();
/* Forside-detektion: begge forsider (/ og /p/forside) er samme dokument med
   data-link="/". Modalen vises kun, når intet valg er gemt endnu. */
if(document.body.getAttribute("data-link") === "/" && !laesValg()) byggModal();
})();
