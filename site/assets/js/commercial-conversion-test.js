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
      sub.insertAdjacentHTML('afterend', '<p class="commercial-test-note"><strong>Start med et prisoverslag.</strong> Helt stille og roligt. Du vælger selv, om vi skal tage næste skridt.</p>');
    }

    var proof = section('<section class="commercial-section commercial-section--proof" id="kundeord" aria-labelledby="commercial-proof-title"><div class="commercial-inner"><div class="commercial-heading"><span class="commercial-preview-label">Tekstskitser til preview. Ikke ægte kundeudtalelser endnu.</span><h2 id="commercial-proof-title">Det er ret rart ikke at skulle huske det hele selv</h2><p>Det siger de heldige karltofler. Eller det håber vi, de kommer til.</p></div><div class="commercial-quotes"><article class="commercial-quote commercial-quote--lead"><blockquote>Jeg slap for at ringe til en masse forskellige leverandører. Nu ligger opgaverne i fast rul, og det fungerer virkelig godt.</blockquote><cite>Testkunde 1</cite></article><div class="commercial-quote-stack"><article class="commercial-quote"><blockquote>Der var ikke rigtig styr på vedligeholdelsen. Karltoffel gjorde det nemt allerede fra første besøg.</blockquote><cite>Testkunde 2</cite></article><article class="commercial-quote"><blockquote>Det giver ro, at besøgene ligger fast. Vi skal ikke længere holde øje med, hvad der trænger.</blockquote><cite>Testkunde 3</cite></article></div></div></div></section>');
    offer.closest('.section').insertAdjacentElement('afterend', proof);

    var plan = section('<section class="commercial-section commercial-section--plan" id="fast-plan" aria-labelledby="commercial-plan-title"><div class="commercial-inner commercial-plan-shell"><div class="commercial-plan-intro"><h2 id="commercial-plan-title">Vi samler opgaverne i en fast plan. Så slipper du for det.</h2><p>Én plan. Én samarbejdspartner. Betydeligt færre ting, du selv skal holde styr på.</p></div><div class="commercial-plan-steps"><article class="commercial-plan-step"><span class="commercial-plan-number">1</span><div><h3>Vi finder det, der skal ordnes</h3><p>Hus, have eller lidt af hvert. Vi samler de opgaver, der giver mening for dig.</p></div></article><article class="commercial-plan-step"><span class="commercial-plan-number">2</span><div><h3>Vi sætter det i fast rul</h3><p>Så bliver tingene ordnet, før de ender på den lange liste over ting, du burde have gjort.</p></div></article><article class="commercial-plan-step"><span class="commercial-plan-number">3</span><div><h3>Du laver noget sjovere</h3><p>Vi holder styr på planen. Du nyder, at hus og have står skarpt.</p></div></article></div></div></section>');
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

    var help = section('<div class="cell commercial-help-card"><div class="card card--package in-view in-view--slide-up"><div class="card__label">I tvivl?</div><div class="card__content"><div class="card__intro"><h3 class="card__title">Vi finder pakken sammen</h3><div class="card__description rte">Fortæl os, hvad der trænger. Så hjælper vi med at få det hele i fast rul.</div><div class="filler"></div><a href="tel:+4522223833" class="card__button"><span>Tag en snak med os</span></a></div><div class="card__body"><ul class="card__services"><li><span class="card__service-icon"><i class="fa-default fa-check card__service-icon__state card__service-icon__state--on"></i></span><span class="card__service-label">Vi gennemgår dine behov</span></li><li><span class="card__service-icon"><i class="fa-default fa-check card__service-icon__state card__service-icon__state--on"></i></span><span class="card__service-label">Vi samler de rigtige opgaver</span></li><li><span class="card__service-icon"><i class="fa-default fa-check card__service-icon__state card__service-icon__state--on"></i></span><span class="card__service-label">Du får en plan uden bøvl</span></li></ul></div></div></div>');
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

  if (window.location.hash) {
    var anchor = document.querySelector(window.location.hash);
    if (anchor) {
      window.requestAnimationFrame(function () {
        anchor.scrollIntoView({ block: 'start' });
      });
    }
  }
}());
