/* Karltoffel – Meta Pixel formular-events.
 * Læs konfigurationen fra script-taggets data-forms-attribut (JSON):
 *   [{ "selector": ".sp-form__fields", "index": 0, "content_name": "haekklipning-landing-hero" }, ...]
 * Fires fbq('track','Lead',{content_name}) når den matchende formular submittes.
 * content_name skal være UNIK pr. formular — den bruges til custom conversions i Meta.
 * Fejler stille (ingen pixel / ingen konfiguration / fbq ikke loadet endnu er OK —
 * fbq-stubbet fra pixel-snippetten queuer events indtil fbevents.js er loadet).
 */
(function () {
  "use strict";
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
        if (typeof window.fbq === "function") {
          window.fbq("track", "Lead", { content_name: name, content_type: "form" });
        }
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
