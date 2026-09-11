/* Kontakt-sidens ring-op-formular (2026-09-11).
   Sender til CRM'ets lead-relay /api/lead — samme flade som erhvervsside-
   formularen. Privat kundetype, source "kontakt-ringop". Fejler stille med
   en venlig fejlbesked, aldrig med teknisk jargon. */
(function(){
	"use strict";
	var form = document.getElementById("kontakt-ringop-form");
	if(!form) return;
	var status = document.getElementById("ko-status");
	var button = form.querySelector("button[type=submit]");

	function showStatus(message, isError){
		status.textContent = message;
		status.setAttribute("data-error", isError ? "true" : "false");
		status.hidden = false;
	}

	form.addEventListener("submit", function(event){
		event.preventDefault();
		var data = new FormData(form);
		var name = String(data.get("navn") || "").trim();
		var phone = String(data.get("telefon") || "").trim();

		if(!name || phone.replace(/\D/g, "").length < 8){
			showStatus("Udfyld dit navn og et telefonnummer med mindst 8 cifre, så ringer vi dig op.", true);
			return;
		}

		button.disabled = true;
		button.textContent = "Sender...";

		/* Meta CAPI-dedup: samme event_id til fbq (browser) og CRM'ets
		   server-side Conversions API-kald (via payload.meta_capi). */
		var metaEventId;
		try {
			metaEventId = (window.crypto && typeof window.crypto.randomUUID === "function")
				? window.crypto.randomUUID()
				: "ko-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
		} catch(e) {
			metaEventId = "ko-" + Date.now().toString(36);
		}

		fetch("/api/lead", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: name,
				phone: phone,
				kundetype: "privat",
				source: "kontakt-ringop",
				message: "Kunden vil ringes op fra kontaktsiden.",
				meta_capi: { event_id: metaEventId, content_name: "kontakt-ringop" }
			})
		})
		.then(function(response){
			if(!response.ok) throw new Error("HTTP " + response.status);
			form.reset();
			showStatus("Tak. Vi har dit nummer og ringer dig op i åbningstiden (man-fre 8-16).", false);
			try {
				(window.dataLayer = window.dataLayer || []).push({
					event: "generate_lead",
					lead_source: "kontakt-ringop",
					lead_kundetype: "privat"
				});
			} catch(e){}
			try {
				if (typeof window.fbq === "function") {
					window.fbq("track", "Lead", { content_name: "kontakt-ringop", content_type: "form" }, { eventID: metaEventId });
				}
			} catch(e){}
		})
		.catch(function(){
			showStatus("Vi kunne ikke sende din forespørgsel lige nu. Prøv igen om et øjeblik, eller ring til os på 22 22 38 33.", true);
		})
		.finally(function(){
			button.disabled = false;
			button.textContent = "Ja tak - ring mig op";
		});
	});
})();