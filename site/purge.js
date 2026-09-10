const { PurgeCSS } = require('purgecss');
const fs = require('fs');
const jsClasses = fs.readFileSync('/tmp/jsclasses.txt','utf8').split('\n').filter(c=>c && !c.includes('${') && /^[A-Za-z0-9_\- ]+$/.test(c));
const safelistPatterns = [
  /^swiper-/,/^in-view/,/^tm-/,/^kt-/,/^cookiescript/,/^csconsentlink/,/^collapse/,/^drawer/,/^header--/,
  /^is-/,/^has-/,/^active$/,/^open$/,/^selected$/,/^hidden$/,/^visible$/,/^show$/,/^open$/,/^on$/,/^done$/,
  /^erhverv$/,/^privat$/,/^digging$/,/^fancy/,,,,/^counter/,/^counters/,
  /^card--/,/^sf-/,/^row--off$/,/^qrow$/,/^pw/,/^qw/,/^fw/,/^rk-/,/^offer-tooltip/,/^instagram/,/^leaf/,
  /^error$/,/^hint$/,/^rte/,/^fw/,,/^responsive-embed/,/^read-more$/,/^remove-file$/,
  /^form__spinner$/,/^counter/,/^site-nav/,/^search/,/^leaflet-/,/^lw/,/^gmaps/,/^mapbox/,
  /^expanded$/,/^announcement-bar/,/^popup/,/^statement-popup/,/^animation-start$/,/^form-error$/,
  /^show-for-sticky$/,/^hide-for-sticky$/,/^rte--right/,/^can-zoom/,/^card--service--no-image$/,
  /^cookiescript/,/^logo-slider/,/^instagram/,/^top-bar__images/,/^articles-slider/,/^home-packages/,
  /^carousel__/,,,/^type_/,/^field/,/^form/,/^menu$/,/^lead$/,/^heading$/,/^full$/,/^vertical$/,
  ...jsClasses.map(c=>new RegExp('^'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'))
];
safelistPatterns.pop();
const safelistStandard = [/^data-/, /^aria-/];
(async () => {
  const result = await new PurgeCSS().purge({
    content: [
      'dist/**/*.html',
      'assets/js/site.js','assets/js/tilbudsmotor.js','assets/js/skraafoto.js',
      'assets/js/erhverv.js','assets/js/meta-events.js','assets/js/in-view-fallback.js',
      'assets/js/swiper.js'
    ],
    css: ['assets/css/style.legacy.css'],
    safelist: {
      standard: safelistPatterns,
      deep: [/^swiper-/, , , /^ui-datepicker/, /^f-carousel/, /^f-thumbs/, /^f-spinner/],
      greedy: [/^swiper-/, /^in-view/, /^tm-/, /^kt-/, /^is-/, /^has-/, /^header--/, /^drawer/, /^collapse/,  , , /^offer-tooltip/]
    }
  });
  for (const r of result) {
    fs.writeFileSync('assets/css/style.new.css', r.css);
    console.log('style.purged.css bytes:', r.css.length);
  }
})();
