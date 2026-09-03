// in-view sikkerhedsnet: hvis en scroll-transition hænger (langsom/lettet device),
// tvinges alt indhold synligt efter 3 s. Idempotent, ingen afhængigheder.
(function () {
  "use strict";
  setTimeout(function () {
    document.querySelectorAll(".in-view:not(.in-view--visible)").forEach(function (el) {
      el.classList.add("in-view--visible");
    });
  }, 2500);
})();
