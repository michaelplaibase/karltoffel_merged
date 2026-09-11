#!/usr/bin/env node
/**
 * Karltoffel statisk site — single-source build.
 * Læser: src/sider.json, src/data/ydelser.json, src/partials/*, src/sider/<sti>/*
 * Skriver: dist/ (HTML-sider, sitemap.xml, robots.txt, assets/, api/)
 * Køres: node build.js  (fra site/-roden, ren Node-stdlib)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const siderData = JSON.parse(fs.readFileSync(path.join(SRC, 'sider.json'), 'utf8'));
const ydelser = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'ydelser.json'), 'utf8'));
const YD = Object.fromEntries(ydelser.map(y => [y.slug, y]));

const partial = (navn) => fs.readFileSync(path.join(SRC, 'partials', navn), 'utf8');
const HEAD_TPL = partial('head.html');
const HEADER_TPL = partial('header.html');
const FOOTER_TPL = partial('footer.html');
const MOTOR_TPL = partial('tilbudsmotor.html');
const ERHVERV_MOTOR = partial('tilbudsmotor-erhverv.html');
const FCTA_TPL = partial('floating-cta.html');
const FAQ_TPL = partial('faq.html');
const GRID_TPL = partial('ydelseskort-grid.html');
const KORT_TPL = partial('ydelseskort-kort.html');
const PRE = partial('pre.html');
const MELLEM_TPL = partial('mellem.html');
const SLUT_TPL = partial('slut.html');

// sociale links (konstante) — uddrag af forsidens footer-markup
const IG_LINE = '\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<a href="https://www.instagram.com/karltoffel.dk/" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i><span>Instagram</span></a>';
const LI_LINE = '\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<a href="https://www.linkedin.com/company/karltoffel-dk/" target="_blank" title="LinkedIn"><i class="fa-brands fa-linkedin-in"></i><span>LinkedIn</span></a>';
const EM_HTML = '<p><em>Fast aftale og fleksible løsninger · Miljøvenlige metoder · Erfaren og pålidelig service · 100 % tilfredshed - ellers kommer vi igen.</em></p>';

const chunk = (fil, navn) => {
  const p = path.join(SRC, 'sider', fil, navn);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

function renderHead(page, hoveddel) {
  const h = page.head;
  return HEAD_TPL
    .replaceAll('{{TITLE}}', h.title)
    .replaceAll('{{DESCRIPTION}}', h.description)
    .replaceAll('{{NOINDEX_TOP}}', h.noindex_top ? '\n\t<meta name="robots" content="noindex">' : '')
    .replaceAll('{{OG_HTML}}', h.og_html)
    .replaceAll('{{HOVEDDEL}}', hoveddel)
    .replaceAll('{{FLOATING}}', h.floating_linje)
    .replaceAll('{{PIXEL}}', h.pixel);
}

function renderKort(page) {
  if (!page.ydelseskort) return '';
  const yk = page.ydelseskort;
  const dele = yk.kort.map(slug => {
    const y = YD[slug];
    if (!y) throw new Error('Ukendt ydelse: ' + slug);
    const pris = (yk.kontekst === 'erhverv' && y.pris_erhverv) ? y.pris_erhverv : y.pris;
    const tekst = yk.vis_kort_tekst ? y.kort_tekst : '';
    let dimsHtml = '';
    if (y.billede_bredde && y.billede_hoejde) dimsHtml = ' width="' + y.billede_bredde + '" height="' + y.billede_hoejde + '"';
    return KORT_TPL
      .replaceAll('{{HREF}}', '/c/det-vi-ordner/' + slug)
      .replaceAll('{{BILLEDE}}', y.billede)
      .replaceAll('{{IMG_DIMS}}', dimsHtml)
      .replaceAll('{{ALT}}', y.navn)
      .replaceAll('{{PRIS}}', 'Fra ' + pris + ' kr')
      .replaceAll('{{NAVN}}', y.navn)
      .replaceAll('{{KORT_TEKST}}', tekst ? '\n<p style="margin-top:.5rem;">' + tekst + '</p>' : '');
  });
  return GRID_TPL.replaceAll('{{KORT}}', dele.join(''));
}

function renderFaq(page) {
  if (!page.faq) return '';
  const custom = chunk(page.fil, 'faq.html');
  if (custom) return custom;
  const ekstraFil = page.faq_ekstra_fil;
  const ekstra = ekstraFil ? fs.readFileSync(path.join(SRC, 'sider', ekstraFil), 'utf8') : '';
  return FAQ_TPL.replaceAll('{{EKSTRA_SPM}}', ekstra);
}

function renderSide(page) {
  const hoveddel = fs.readFileSync(path.join(SRC, 'sider', page.fil, 'head-hoveddel.html'), 'utf8');
  const pre = chunk(page.fil, 'pre.html') || PRE;
  const parts = [pre, renderHead(page, hoveddel), MELLEM_TPL.replaceAll('{{BODY_TAG}}', page.body_tag)];
  const hdrChunk = chunk(page.fil, 'header.html');
  let hp;
  if (hdrChunk) {
    hp = hdrChunk;
  } else {
    hp = HEADER_TPL.replaceAll('{{CTA_HREF}}', page.header.cta_href);
    if (!page.header.fixed) hp = hp.replace(' header--fixed', '', 1);
    if (page.header.nav_active) {
      const esc = page.header.nav_active.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      hp = hp.replace(new RegExp('<li class="nav__item">(\\s*<a href="' + esc + '")', 'g'),
                      '<li class="nav__item nav__item--active">$1');
    }
  }
  parts.push(hp);
  let content = fs.readFileSync(path.join(SRC, 'sider', page.fil, 'content.html'), 'utf8');
  content = content.replaceAll('[[YDELSeskort]]', renderKort(page)).replaceAll('[[FAQ]]', renderFaq(page));
  parts.push(content);
  if (page.motor) {
    parts.push(page.motor.type === 'erhverv'
      ? ERHVERV_MOTOR
      : MOTOR_TPL.replaceAll('{{SUB_TEKST}}', page.motor.sub_tekst));
  }
  const post = chunk(page.fil, 'post.html');
  if (post) parts.push(post.replaceAll('[[FAQ]]', renderFaq(page)).replaceAll('[[YDELSeskort]]', renderKort(page)));
  const ftrChunk = chunk(page.fil, 'footer.html');
  let fp;
  if (ftrChunk) {
    fp = ftrChunk;
  } else {
    fp = FOOTER_TPL.replaceAll('{{CTA_HREF}}', page.footer.cta_href)
      .replaceAll('{{EM_PARAGRAF}}', page.footer.em_paragraf ? EM_HTML : '')
      .replaceAll('{{SOCIAL_IG}}', page.footer.social === 'kun-facebook' ? '' : IG_LINE)
      .replaceAll('{{SOCIAL_LI}}', page.footer.social === 'kun-facebook' ? '' : LI_LINE);
  }
  parts.push(fp);
  parts.push(fs.readFileSync(path.join(SRC, 'sider', page.fil, 'tail.html'), 'utf8'));
  if (page.floating_cta) {
    parts.push(FCTA_TPL.replaceAll('{{CTA_HREF}}', page.floating_cta));
    const slutChunk = chunk(page.fil, 'slut.html');
    parts.push(slutChunk || SLUT_TPL);
  } else {
    parts.push('\n</body>\n</html>');
  }
  return parts.join('');
}

function kopierDir(fra, til) {
  fs.cpSync(fra, til, { recursive: true });
}

// ---------- build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

for (const page of siderData.sider) {
  const html = renderSide(page);
  const outDir = path.join(DIST, page.sti.replace(/^\//, ''));
  if (page.sti.endsWith('.html')) {
    fs.writeFileSync(outDir, html);
  } else {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
  }
}

// robots.txt
fs.writeFileSync(path.join(DIST, 'robots.txt'),
  'User-agent: *\nAllow: /\n\nSitemap: https://karltoffel.dk/sitemap.xml\n');

// sitemap.xml (kun indekserbare sider)
const urls = siderData.sider.filter(s => s.i_sitemap).map(s =>
  ' <url>\n  <loc>https://karltoffel.dk' + (s.sti === '/' ? '/' : s.sti) + '</loc>\n  <lastmod>' + siderData.dagens_dato + '</lastmod>\n </url>');
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

// assets + api kopieres uændret
kopierDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
kopierDir(path.join(ROOT, 'api'), path.join(DIST, 'api'));

console.log('Bygget ' + siderData.sider.length + ' sider til dist/ (' + urls.length + ' sitemap-URL\u2019er)');
