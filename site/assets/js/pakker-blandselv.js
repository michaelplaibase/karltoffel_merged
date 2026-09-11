/* Pakker & priser: "Se alle 17 muligheder"-udfold (Mads 2026-09-11) */
(function(){
	"use strict";
	var btn = document.getElementById("pp-bland-toggle");
	var liste = document.getElementById("pp-bland-liste");
	if(!btn || !liste) return;
	btn.addEventListener("click", function(){
		var aaben = liste.hidden;
		liste.hidden = !aaben;
		btn.setAttribute("aria-expanded", aaben ? "true" : "false");
		var icon = btn.querySelector(".pp-bland-toggle__icon");
		if(icon) icon.textContent = aaben ? "–" : "+";
		btn.firstChild.textContent = aaben ? "Skjul muligheder " : "Se alle 17 muligheder ";
	});
})();