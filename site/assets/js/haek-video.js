/* Video-afspiller (Mads 2026-09-11): ingen download før klik.
   - video-src ligger i data-src og sæts først ved tryk på afspil
   - preload="none" + poster (komprimeret stillbillede)
   - browserens almindelige afspiller: controls + playsinline
   - høformat: pladsen er reserveret via aspect-ratio i CSS */
(function(){
	"use strict";
	document.querySelectorAll(".sp-video").forEach(function(box){
		var btn = box.querySelector(".sp-video__play");
		var vid = box.querySelector("video");
		if(!btn || !vid) return;
		btn.addEventListener("click", function(){
			var src = vid.getAttribute("data-src");
			if(src && !vid.getAttribute("src")) vid.setAttribute("src", src);
			vid.play();
			box.classList.add("sp-video--playing");
		});
	});
})();