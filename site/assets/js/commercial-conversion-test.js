(function () {
  function section(markup) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = markup.trim();
    return wrapper.firstElementChild;
  }

  var offer = document.getElementById('tilbudsmotor');
  if (offer) {
    var sub = offer.querySelector('#step-adresse .sub');
    if (sub) {
      sub.insertAdjacentHTML('afterend', '<p class="commercial-test-note"><strong>Få først et prisoverslag.</strong> Du vælger selv, om vi skal tage næste skridt.</p>');
    }

    var proof = section('<section class="commercial-section commercial-section--proof" aria-labelledby="commercial-proof-title"><div class="commercial-inner"><div class="commercial-heading"><span class="commercial-eyebrow">Testindhold</span><h2 id="commercial-proof-title">Mindre koordinering. Mere ro i hverdagen.</h2><p>Simulerede kundeudtalelser til vurdering i denne testversion.</p></div><div class="commercial-grid"><article class="commercial-card"><blockquote>“Jeg slap for at ringe til en masse leverandører og fik alle opgaver sat i fast rul. Det fungerer virkelig godt.”</blockquote><cite>Testkunde 1</cite></article><article class="commercial-card"><blockquote>“Der var ingen struktur på vedligeholdelsen, og jeg vidste ikke, hvor jeg skulle begynde. Karltoffel gjorde det nemt fra første besøg.”</blockquote><cite>Testkunde 2</cite></article><article class="commercial-card"><blockquote>“Det giver ro, at besøgene ligger fast. Vi skal ikke længere holde øje med, hvad der trænger, og hjemmet står altid skarpt.”</blockquote><cite>Testkunde 3</cite></article></div></div></section>');
    offer.closest('.section').insertAdjacentElement('afterend', proof);

    var plan = section('<section class="commercial-section commercial-section--plan" aria-labelledby="commercial-plan-title"><div class="commercial-inner"><div class="commercial-heading"><h2 id="commercial-plan-title">Vi samler opgaverne i en fast plan</h2><p>Du får én samlet løsning til den løbende vedligeholdelse, så det bliver lettere at bevare overblikket.</p></div><div class="commercial-grid"><article class="commercial-card"><h3>Ét samlet overblik</h3><p>Vi samler de relevante opgaver, så du ikke selv skal holde styr på forskellige leverandører.</p></article><article class="commercial-card"><h3>Opgaver i fast rul</h3><p>Vedligeholdelsen bliver planlagt, så opgaverne ikke først bliver løst, når de er blevet akutte.</p></article><article class="commercial-card"><h3>En nemmere hverdag</h3><p>Du får en enkel plan og én samarbejdspartner til at hjælpe med at holde hjem og have skarpt.</p></article></div></div></section>');
    proof.insertAdjacentElement('afterend', plan);

    var giftLink = document.querySelector('a.packages-cta-link[href*="/gavekort"]');
    var faqTitle = Array.from(document.querySelectorAll('h2')).find(function (heading) {
      return heading.textContent.trim().indexOf('Alt det praktiske') !== -1;
    });
    if (giftLink && faqTitle) {
      var faqSection = faqTitle.closest('.section');
      if (faqSection) {
        var giftSection = section('<section class="section section--type-packages-slider section--theme-standard commercial-gift-section"><div class="grid-container grid-container--full"></div></section>');
        giftSection.querySelector('.grid-container').appendChild(giftLink);
        faqSection.insertAdjacentElement('afterend', giftSection);
      }
    }
  }

  var packages = document.querySelector('#section-id-273 .packages > .grid-x');
  if (packages) {
    var cards = Array.from(packages.children).filter(function (item) { return item.classList.contains('cell'); });
    cards.slice(2).forEach(function (card) {
      card.classList.add('commercial-extra-package');
      card.hidden = true;
    });

    var help = section('<div class="cell commercial-help-card"><div class="card card--package in-view in-view--slide-up"><div class="card__label">Personlig hjælp</div><div class="card__content"><div class="card__intro"><h3 class="card__title">Få hjælp til at vælge</h3><div class="card__description rte">Til dig, der vil samle opgaverne i en fast plan sammen med os.</div><div class="filler"></div><a href="tel:+4522223833" class="card__button"><span>Ring til os</span></a></div><div class="card__body"><ul class="card__services"><li><span class="card__service-icon"><i class="fa-default fa-check card__service-icon__state card__service-icon__state--on"></i></span><span class="card__service-label">Vi gennemgår dine behov</span></li><li><span class="card__service-icon"><i class="fa-default fa-check card__service-icon__state card__service-icon__state--on"></i></span><span class="card__service-label">Vi samler de relevante opgaver</span></li><li><span class="card__service-icon"><i class="fa-default fa-check card__service-icon__state card__service-icon__state--on"></i></span><span class="card__service-label">Du får en overskuelig plan</span></li></ul></div></div></div>');
    cards[1].insertAdjacentElement('afterend', help);

    if (cards.length > 2) {
      var actions = section('<div class="commercial-package-actions"><button type="button" class="commercial-package-toggle" aria-expanded="false">Se alle pakker</button></div>');
      packages.insertAdjacentElement('afterend', actions);
      actions.querySelector('button').addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        cards.slice(2).forEach(function (card) { card.hidden = expanded; });
        this.setAttribute('aria-expanded', String(!expanded));
        this.textContent = expanded ? 'Se alle pakker' : 'Vis færre pakker';
      });
    }
  }
}());
