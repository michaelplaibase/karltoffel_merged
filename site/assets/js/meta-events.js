/* Karltoffel – Meta Pixel formular-events.
 * Læs konfigurationen fra script-taggets data-forms-attribut (JSON):
 *   [{ "selector": ".sp-form__fields", "index": 0, "content_name": "haekklipning-landing-hero" }, ...]
 * Fires fbq('track','Lead',{content_name},{eventID}) når den matchende formular submittes.
 * content_name skal være UNIK pr. formular — den bruges til custom conversions i Meta.
 * Fejler stille (ingen pixel / ingen konfiguration / fbq ikke loadet endnu er OK —
 * fbq-stubbet fra pixel-snippetten queuer events indtil fbevents.js er loadet).
 *
 * DEDUPLIKATION (Meta CAPI): hvert event får en tilfældig event_id, som både
 * sendes til fbq (tredje parameter {eventID}) og gemmes i sessionStorage
 * ('ktMetaPendingLead'). Hero-/landingformularerne her er GET-formularer der
 * lander i tilbudsmotoren på forsiden — tilbudsmotor.js læser den gemte
 * event_id og sender den med til /api/lead (feltet meta_capi_prior), så
 * CRM'ets server-side Conversions API-kald kan matche browser-eventet 1:1 og
 * Meta tæller konverteringen én gang.
 */
(function () {
  "use strict";

  function uuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    } catch (e) {}
    /* Fallback til ældre browsere: Math.random-blandet UUID-v4-agtig streng. */
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var tag = document.currentScript || document.querySelector("script[data-forms]");
  if (!tag) return;
  var cfg;
  try { cfg = JSON.parse(tag.getAttribute("data-forms") || "[]"); } catch (e) { return; }
  if (!cfg || !cfg.length) return;

  function track(el, name) {
    if (!el || el.__ktMetaTracked) return;
    el.__ktMetaTracked = true;
    el.addEventListener("submit", function () {
      try {
        var id = uuid();
        if (typeof window.fbq === "function") {
          window.fbq("track", "Lead", { content_name: name, content_type: "form" }, { eventID: id });
        }
        /* Fragt event_id + content_name videre til tilbudsmotoren (og dermed
           CAPI-kaldet) — overskrives pr. ny hero-formular, hvilket er fint:
           den seneste side besøgte er den relevante attribution. */
        try {
          window.sessionStorage.setItem("ktMetaPendingLead", JSON.stringify({ event_id: id, content_name: name }));
        } catch (e2) {}
      } catch (e) {}
    });
  }

  cfg.forEach(function (c) {
    if (!c || !c.selector || !c.content_name) return;
    var els = document.querySelectorAll(c.selector);
    if (typeof c.index === "number") {
      track(els[c.index], c.content_name);
    } else {
      Array.prototype.forEach.call(els, function (el) { track(el, c.content_name); });
    }
  });
})();
