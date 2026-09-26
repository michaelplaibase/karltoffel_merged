(function () {
  "use strict";
  var form = document.getElementById("haek-campaign-form");
  if (!form) return;
  var error = document.getElementById("form-error");
  var thanks = document.getElementById("form-thanks");
  var submit = form.querySelector('button[type="submit"]');
  var originalButton = submit.innerHTML;
  var params = new URLSearchParams(window.location.search);
  var utm = {};
  ["source", "medium", "campaign", "term", "content"].forEach(function (key) {
    var value = params.get("utm_" + key);
    if (value) utm[key] = value.slice(0, 100);
  });

  function value(name) {
    var field = form.elements[name];
    return field ? String(field.value || "").trim() : "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    error.hidden = true;
    var name = value("name");
    var phone = value("phone");
    var email = value("email");
    var address = value("address");
    if (!name || phone.replace(/\D/g, "").length < 8 || !/.+@.+\..+/.test(email) || !address) {
      error.textContent = "Tjek navn, telefon, e-mail og adresse — og prøv igen.";
      error.hidden = false;
      return;
    }
    if (submit.disabled) return;
    submit.disabled = true;
    submit.textContent = "Sender…";
    var details = [
      value("meter") ? "Ca. " + value("meter") + " meter hæk" : "Længde ikke oplyst",
      value("height") ? "Højde: " + value("height") : "Højde ikke oplyst",
      value("sides") ? "Sider: " + value("sides") : "Sider ikke oplyst",
      value("details") ? "Supplerende: " + value("details").slice(0, 700) : ""
    ].filter(Boolean).join(". ");
    var payload = {
      name: name,
      phone: phone,
      email: email,
      address: address,
      kundetype: "privat",
      source: "haek-free-vindue-landing",
      message: "Kampagneforespørgsel – hækklipning + vinduesvask på vores regning ved bestilling af hæk. Kunden ønsker et tilbud på telefonen. " + details,
      services: [{ id: "haek", navn: "Hækklipning – kampagneforespørgsel", wm: null, qty: Number(value("meter")) || 0, enhed: "m hæk", freq: 1, pris: null }],
      haekInfo: { meter: Number(value("meter")) || null, hoejde: value("height"), sider: value("sides"), campaign: "haek-free-vindue-test" },
      ...(Object.keys(utm).length ? { utm: utm } : {})
    };
    fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error("Lead relay HTTP " + response.status);
      form.hidden = true;
      thanks.hidden = false;
      thanks.scrollIntoView({ behavior: "smooth", block: "center" });
    }).catch(function () {
      error.textContent = "Vi kunne ikke sende forespørgslen lige nu. Prøv igen, eller ring 22 22 38 33.";
      error.hidden = false;
      submit.disabled = false;
      submit.innerHTML = originalButton;
    });
  });
})();
