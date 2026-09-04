(function(){
	"use strict";
	var form = document.getElementById("erhverv-callback-form");
	if(!form) return;

	var status = document.getElementById("erhverv-form-status");
	var button = form.querySelector("button[type=submit]");

	function showStatus(message, isError){
		status.textContent = message;
		status.hidden = false;
		status.setAttribute("data-error", isError ? "true" : "false");
	}

	form.addEventListener("submit", function(event){
		event.preventDefault();
		var data = new FormData(form);
		var name = String(data.get("name") || "").trim();
		var phone = String(data.get("phone") || "").trim();
		var email = String(data.get("email") || "").trim();
		var address = String(data.get("address") || "").trim();

		if(!address || !name || phone.replace(/\D/g, "").length < 8){
			showStatus("Udfyld adresse, navn og et telefonnummer med mindst 8 cifre.", true);
			return;
		}
		if(email && email.indexOf("@") < 1){
			showStatus("Tjek lige e-mailen. Den ser ikke rigtig ud.", true);
			return;
		}

		button.disabled = true;
		button.textContent = "Sender...";
		status.hidden = true;

		/* Meta CAPI-dedup: samme event_id til fbq (browser) og CRM'ets
		   server-side Conversions API-kald (via payload.meta_capi). */
		var metaEventId;
		try {
			metaEventId = (window.crypto && typeof window.crypto.randomUUID === "function")
				? window.crypto.randomUUID()
				: "erh-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
		} catch (e) {
			metaEventId = "erh-" + Date.now().toString(36);
		}

		fetch("/api/lead", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: name,
				phone: phone,
				email: email,
				address: address,
				kundetype: "erhverv",
				source: "erhverv-tilbagekald",
				message: "Ønsker opkald om erhvervsservice. Adresse: " + address,
				meta_capi: { event_id: metaEventId, content_name: "erhverv-tilbagekald" }
			})
		})
		.then(function(response){
			if(!response.ok) throw new Error("HTTP " + response.status);
			form.reset();
			showStatus("Tak. Vi har din adresse og ringer dig op hurtigst muligt.", false);
			try {
				(window.dataLayer = window.dataLayer || []).push({
					event: "generate_lead",
					lead_source: "erhverv-tilbagekald",
					lead_kundetype: "erhverv"
				});
			} catch(e){}
			try {
				if (typeof window.fbq === "function") {
					window.fbq("track", "Lead", { content_name: "erhverv-tilbagekald", content_type: "form" }, { eventID: metaEventId });
				}
			} catch(e){}
		})
		.catch(function(){
			showStatus("Vi kunne ikke sende din forespørgsel lige nu. Prøv igen om et øjeblik, eller ring til os.", true);
		})
		.finally(function(){
			button.disabled = false;
			button.textContent = "Bed os ringe dig op";
		});
	});
})();
