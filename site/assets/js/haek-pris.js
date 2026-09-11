/* Hækklipning pilot (Opgave C, Mads 2026-09-11): to-trins prismotor i heroen.
   Trin 1: antal meter → trin 2: prisvisning + navn/telefon (eller mail).
   Priser hentes fra prismotorens simple version (samme grundlag som
   tilbudsmotoren: trimning 27 kr/m, min. 250 kr). LEAD til /api/lead med
   source "haek-pris-hero" + estimat, mærket som ikke-fuldt tilbud. */
(function(){
	"use strict";
	var form = document.getElementById("haek-pris-form");
	if(!form) return;

	var STEP1 = document.getElementById("hp-step1");
	var STEP2 = document.getElementById("hp-step2");
	var meterInput = document.getElementById("hp-meter");
	var err1 = document.getElementById("hp-err1");
	var prisBoks = document.getElementById("hp-pris-boks");
	var navn = document.getElementById("hp-navn");
	var telefon = document.getElementById("hp-telefon");
	var mail = document.getElementById("hp-mail");
	var err2 = document.getElementById("hp-err2");
	var status = document.getElementById("hp-status");
	var submit = document.getElementById("hp-submit");
	var knapTekst = document.getElementById("hp-knap-tekst");
	var knapTekst2 = document.getElementById("hp-knap-tekst-2");
	var mailLink = document.getElementById("hp-mail-link");
	var mailFelt = document.getElementById("hp-mailfelt");
	var tlfFelt = document.getElementById("hp-tlf-felt");
	var besked = document.getElementById("hp-besked");

	var mode = "tlf";
	var meter = 0;
	var pris = 0;

	/* PRIS_MOTOR — simple version. Samme kilde som tilbudsmotoren:
	   trimning 27,00 kr/m (hæk under 220 cm), mindestepris 250 kr. */
	var PRIS = { trimning: 27.00, minimum: 250 };
	function formatKr(n){ return Math.round(n).toLocaleString("da-DK"); }

	function visTrin2(){
		var m = String(meterInput.value).replace(/\s/g,"").replace(",",".");
		var n = Number(m);
		if(!m || !isFinite(n) || n <= 0){
			err1.hidden = false;
			return;
		}
		meter = n;
		pris = Math.max(PRIS.trimning * meter, PRIS.minimum);
		prisBoks.innerHTML = '<p class="hp-pris">Ca. ' + formatKr(pris) + ' Kr.</p>' +
			'<p class="hp-pris-note">Estimat for ' + formatKr(meter) + ' m hæk ved almindelig trimning af én side og top, under 2,2 m. Bortkørsel er ikke medregnet. Endelig pris afhænger af hækken og opgaven.</p>' +
			'<button type="button" class="hp-ret" id="hp-ret">Ret antal meter</button>';
		var ret = document.getElementById("hp-ret");
		if(ret) ret.addEventListener("click", function(){
			STEP2.hidden = true;
			STEP1.hidden = false;
			knapTekst.textContent = "Se din pris";
			meterInput.focus();
		});
		knapTekst.textContent = "Ja tak - ring mig op";
		STEP1.hidden = true;
		STEP2.hidden = false;
		/* Datalag: "Se din pris"-klik — maelger hvor mange der naaar trin 2. */
		try {
			(window.dataLayer = window.dataLayer || []).push({
				event: "haek_se_din_pris",
				haek_meter: meter
			});
		} catch(e5){}
	}

	function visMail(vis){
		mode = vis ? "mail" : "tlf";
		mailFelt.hidden = !vis;
		tlfFelt.hidden = vis;
		mailLink.textContent = vis ? "Jeg vil hellere ringes op" : "Jeg vil hellere kontaktes på mail";
		if(vis) mail.focus(); else telefon.focus();
	}

	function showStatus(t, isErr){
		status.textContent = t;
		status.setAttribute("data-error", isErr ? "true" : "false");
		status.hidden = false;
	}

	form.addEventListener("submit", function(e){
		e.preventDefault();
		err2.hidden = true;
		if(STEP1.hidden === false){ visTrin2(); return; }

		var n = String(navn.value || "").trim();
		if(!n){
			err2.textContent = "Skriv dit navn, så vi kan kontakte dig.";
			err2.hidden = false;
			return;
		}
		var kontakt;
		if(mode === "tlf"){
			var t = String(telefon.value || "").trim();
			if(t.replace(/\D/g,"").length < 8){
				err2.textContent = "Skriv et telefonnummer med mindst 8 cifre — eller vælg mail.";
				err2.hidden = false;
				return;
			}
			kontakt = { phone: t, email: "" };
		} else {
			var m = String(mail.value || "").trim();
			if(m.indexOf("@") < 1){
				err2.textContent = "Tjek lige mailadressen — den ser ikke rigtig ud.";
				err2.hidden = false;
				return;
			}
			kontakt = { phone: "", email: m };
		}
		if(submit.dataset.busy === "1") return;
		submit.dataset.busy = "1";
		submit.disabled = true;

		var metaEventId;
		try {
			metaEventId = (window.crypto && typeof window.crypto.randomUUID === "function")
				? window.crypto.randomUUID()
				: "hk-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
		} catch(e2) {
			metaEventId = "hk-" + Date.now().toString(36);
		}

		var beskedTxt = String((besked && besked.value) || "").trim().slice(0, 900);
		var payload = {
			name: n,
			phone: kontakt.phone,
			email: kontakt.email,
			kundetype: "privat",
			/* Markér at dette IKKE er den fulde tilbudsformular: kunden har kun
			   tastet meter og fået et estimat af prismotorens simple version. */
			source: "haek-pris-hero",
			message: "Pris-estimat fra hækklipningens 2-trins hero-formular. Ca. " + meter + " m hæk, estimat ca. " + formatKr(pris) + " kr (trimning, én side og top, under 2,2 m; bortkørsel ikke medregnet). IKKE den fulde tilbudsformular — vi bekræfter prisen på opkaldet." + (beskedTxt ? " Kundens beskrivelse: " + beskedTxt : ""),
			services: [{ id: "haek", navn: "Hækklipning", wm: "Hækklipning 1 side pr meter Under 220 cm", qty: meter, enhed: "m hæk", freq: 1, pris: PRIS.trimning }],
			estimat: { md: pris, aar: pris, visits: 1, count: 1 },
			haekInfo: { meter: meter, heroEstimat: true },
			meta_capi: { event_id: metaEventId, content_name: "haek-pris-hero" }
		};

		fetch("/api/lead", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload)
		})
		.then(function(r){
			if(!r.ok) throw new Error("HTTP " + r.status);
			STEP2.hidden = true;
			status.hidden = false;
			status.removeAttribute("data-error");
			status.textContent = "Tak! Vi ringer dig op med den endelige pris — typisk samme hverdag. Du betaler først, når hækken er klippet.";
			try {
				(window.dataLayer = window.dataLayer || []).push({ event: "generate_lead", lead_source: "haek-pris-hero", lead_kundetype: "privat" });
			} catch(e3){}
			try {
				if (typeof window.fbq === "function") {
					window.fbq("track", "Lead", { content_name: "haek-pris-hero", content_type: "form" }, { eventID: metaEventId });
				}
			} catch(e4){}
		})
		.catch(function(){
			showStatus("Vi kunne ikke sende det lige nu. Prøv igen — eller ring 22 22 38 33.", true);
			submit.dataset.busy = "0";
			submit.disabled = false;
		});
	});

	mailLink.addEventListener("click", function(e){
		e.preventDefault();
		visMail(mode === "tlf");
	});
})();