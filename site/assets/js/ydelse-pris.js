/* Ydelsesside-prismotor: generaliseret fra hæk-piloten (Opgave C rulleud, Mads 2026-09-11).
   Genbruger .hp-form/.hp-steps-klasserne fra hækklipningen — samme udtryk. */
(function(){
	"use strict";
	var form = document.getElementById("ydelse-pris-form");
	if(!form) return;
	var C = (window.KARLTOFFEL && window.KARLTOFFEL.ydelsePris) || null;
	if(!C) return;

	var STEP1 = document.getElementById("yp-step1");
	var STEP2 = document.getElementById("yp-step2");
	var err1 = document.getElementById("yp-err1");
	var prisBoks = document.getElementById("yp-pris-boks");
	var navn = document.getElementById("yp-navn");
	var err2 = document.getElementById("yp-err2");
	var status = document.getElementById("yp-status");
	var submit2 = document.getElementById("yp-submit2");
	var knapTekst = document.getElementById("yp-knap-tekst");
	var mailLink = document.getElementById("yp-mail-link");
	var mailFelt = document.getElementById("yp-mailfelt");
	var tlfFelt = document.getElementById("yp-tlf-felt");
	var besked = document.getElementById("yp-besked");
	var kontaktWrap = document.getElementById("yp-kontakt");

	var mode = "tlf";
	var vaerdier = {};
	var pris = 0;

	function formatKr(n){ return Math.round(n).toLocaleString("da-DK"); }

	function laesFelter(){
		var out = {};
		(C.felter || []).forEach(function(f){
			var el = document.getElementById("yp-felt-" + f.id);
			if(!el) return;
			if(f.type === "check"){
				out[f.id] = !!el.checked;
				return;
			}
			if(f.type === "radio"){
				var sel = el.querySelector(".yp-radio.selected");
				out[f.id] = sel ? sel.getAttribute("data-val") : "";
				return;
			}
			var v = String(el.value).replace(/\s/g,"").replace(",",".");
			var n = Number(v);
			out[f.id] = (v && isFinite(n) && n > 0) ? n : 0;
		});
		return out;
	}

	function visTrin2(){
		if(!STEP2 || !prisBoks) return;
		var f = laesFelter();
		vaerdier = f;
		var harEn = Object.keys(f).some(function(k){ return typeof f[k]==="string" ? !!f[k] : f[k] > 0; });
		if(!harEn){
			err1.hidden = false;
			return;
		}
		pris = C.prisFn ? C.prisFn(f) : 0;
		var noteTxt = C.prisNoteFn ? C.prisNoteFn(f) : "";
		prisBoks.innerHTML = (C.visPris === false ? "" : '<p class="hp-pris">Ca. ' + formatKr(pris) + ' Kr.</p>')
			+ '<p class="hp-pris-note">' + noteTxt + '</p>'
			+ '<button type="button" class="hp-ret" id="yp-ret">Ret antal</button>';
		var ret = document.getElementById("yp-ret");
		if(ret) ret.addEventListener("click", function(){
			STEP2.hidden = true;
			STEP1.hidden = false;
			if(knapTekst) knapTekst.textContent = C.ctaTrin1 || "Se din pris";
			var first = document.getElementById("yp-felt-" + (C.felter||[])[0].id);
			if(first) first.focus();
		});
		knapTekst.textContent = C.ctaTrin2 || "Ja tak - ring mig op";
		STEP1.hidden = true;
		STEP2.hidden = false;
		/* Datalag: måling af "Se din pris"-klik (samme mønster som hæk-piloten). */
		try {
			(window.dataLayer = window.dataLayer || []).push({
				event: C.dataLayerEvent || "ydelse_se_din_pris",
				ydelse: C.ydelse || "",
				mengder: f
			});
		} catch(e5){}
	}

	function visMail(vis){
		mode = vis ? "mail" : "tlf";
		mailFelt.hidden = !vis;
		tlfFelt.hidden = vis;
		mailLink.textContent = vis ? "Jeg vil hellere ringes op" : "Jeg vil hellere kontaktes på mail";
		if(vis) { var mailEl = document.getElementById("yp-mail"); if(mailEl) mailEl.focus(); } else document.getElementById("yp-telefon").focus();
	}

	form.addEventListener("submit", function(e){
		e.preventDefault();
		if(err1) err1.hidden = true;
		if(err2) err2.hidden = true;
		if(STEP1 && STEP1.hidden === false && STEP2){ visTrin2(); return; }
		/* Kun-kontakt (fliserens, haveaffald): trin1 = kontakt direkte. */

		var n = String(navn.value || "").trim();
		if(!n){
			err2.textContent = "Skriv dit navn, så vi kan kontakte dig.";
			err2.hidden = false;
			return;
		}
		var kontakt;
		if(mode === "tlf"){
			var t = String(document.getElementById("yp-telefon").value || "").trim();
			if(t.replace(/\D/g,"").length < 8){
				err2.textContent = "Skriv et telefonnummer med mindst 8 cifre — eller vælg mail.";
				err2.hidden = false;
				return;
			}
			kontakt = { phone: t, email: "" };
		} else {
			var m = String((document.getElementById("yp-mail") || {}).value || "").trim();
			if(m.indexOf("@") < 1){
				err2.textContent = "Tjek lige mailadressen — den ser ikke rigtig ud.";
				err2.hidden = false;
				return;
			}
			kontakt = { phone: "", email: m };
		}
		if(submit2.dataset.busy === "1") return;
		submit2.dataset.busy = "1";
		submit2.disabled = true;

		var metaEventId;
		try {
			metaEventId = (window.crypto && typeof window.crypto.randomUUID === "function")
				? window.crypto.randomUUID()
				: "yp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
		} catch(e2) {
			metaEventId = "yp-" + Date.now().toString(36);
		}

		var beskedTxt = String((besked && besked.value) || "").trim().slice(0, 900);
		var services = (C.servicesFn ? C.servicesFn(vaerdier) : []).map(function(sv){
			return { id: sv.id, navn: sv.navn, wm: sv.wm || null, qty: sv.qty, enhed: sv.enhed || "", freq: 1, pris: sv.pris };
		});
		var payload = {
			name: n,
			phone: kontakt.phone,
			email: kontakt.email,
			kundetype: "privat",
			source: C.source,
			message: "Pris-estimat fra " + (C.ydelse || "ydelsesside") + "'s 2-trins hero-formular. " + (C.leadNote || "") + (beskedTxt ? " Kundens beskrivelse: " + beskedTxt : ""),
			services: services,
			estimat: { md: pris, aar: pris, visits: 1, count: 1 },
			meta_capi: { event_id: metaEventId, content_name: C.contentName || ((C.ydelse || "ydelse") + "-pris-hero") }
		};

		fetch("/api/lead", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload)
		})
		.then(function(r){
			if(!r.ok) throw new Error("HTTP " + r.status);
			/* Kvittering (Mads 2026-09-11): skjul ALT andet — kun overskrift "Tak for din besked" + grøn status-tekst. */
			kontaktWrap.hidden = true;
			prisBoks.hidden = true;
			var wrap = form.closest(".sp-form, aside");
			if(wrap) wrap.querySelectorAll(".sp-form__lead").forEach(function(l){ l.hidden = true; });
			var ttl = form.closest(".sp-form, aside") ? form.closest(".sp-form, aside").querySelector(".sp-form__title") : null;
			if(ttl) ttl.textContent = "Tak for din besked";
			var felterWrap = document.getElementById("yp-step1");
			if(felterWrap) felterWrap.hidden = true;
			status.hidden = false;
			status.removeAttribute("data-error");
			status.textContent = C.takTekst || "Tak! Vi ringer dig op med den endelige pris — typisk samme hverdag.";
			try {
				(window.dataLayer = window.dataLayer || []).push({ event: "generate_lead", lead_source: C.contentName || ((C.ydelse || "ydelse") + "-pris-hero"), lead_kundetype: "privat" });
			} catch(e3){}
			try {
				if (typeof window.fbq === "function") {
					window.fbq("track", "Lead", { content_name: C.contentName || ((C.ydelse || "ydelse") + "-pris-hero"), content_type: "form" }, { eventID: metaEventId });
				}
			} catch(e4){}
		})
		.catch(function(){
			status.textContent = "Vi kunne ikke sende det lige nu. Prøv igen — eller ring 22 22 38 33.";
			status.setAttribute("data-error", "true");
			status.hidden = false;
			submit2.dataset.busy = "0";
			submit2.disabled = false;
		});
	});

	mailLink.addEventListener("click", function(e){
		e.preventDefault();
		visMail(mode === "tlf");
	});

	/* Radio-valg: markér valgt + skjul evt. fejl */
	form.addEventListener("click", function(e){
		var btn = e.target.closest ? e.target.closest(".yp-radio") : null;
		if(!btn) return;
		var grp = btn.closest(".yp-radio-grp");
		if(!grp) return;
		grp.querySelectorAll(".yp-radio").forEach(function(x){
			x.classList.toggle("selected", x === btn);
			x.setAttribute("aria-pressed", x === btn ? "true" : "false");
		});
		if(err1) err1.hidden = true;
	});
})();