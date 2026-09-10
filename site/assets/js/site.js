/* site.js — Karltoffel (Runde 4, Preview B)
   Sitets egen kode udskilt fra Bubbles temabundle (script.js, 872 KB).
   Alt omskrevet til vanilla JS (jQuery fjernet). Swiper ligger nu separat i swiper.js.
   Bevarede funktioner: FAQ-collapse, drawer/menu, header hide-on-scroll,
   in-view-observer (BubbleInView), smooth scroll, FAQ/section/packages/statement-
   sliders init, hero-/drawer-højde, package-intro-højde, tomme <p> fjernes,
   responsive-embed, eksterne links target=_blank, cookie-knap til CookieScript,
   Cookies-shim (selected_package til tilbudsmotoren).
   Fjernet fra bundlen (ikke brugt på sitet): jQuery, jQuery UI, Fancybox,
   Isotope, imagesLoaded, Leaflet, OpenLayers, Instafeed, datepicker, blogsearch,
   form-spinner (siderne har egne forms), card-video, header split-nav, offer-tooltip,
   logo-slider/instagram-slider/top-bar__images (findes ikke i byggede sider). */

/* ---------- Cookies-shim (tilbudsmotor + card--package) ---------- */
var Cookies = (function () {
  function get(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }
  function set(name, value, attrs) {
    attrs = attrs || {};
    var s = encodeURIComponent(name) + '=' + encodeURIComponent(value) + ';path=' + (attrs.path || '/');
    if (attrs.expires) s += '; expires=' + new Date(Date.now() + attrs.expires * 864e5).toUTCString();
    document.cookie = s;
  }
  function remove(name, attrs) {
    attrs = attrs || {};
    set(name, '', { path: attrs.path || '/', expires: -1 });
  }
  return { get: get, set: set, remove: remove };
})();

/* ---------- Hjælpere: slideUp/slideDown (erstatter jQuery-animation) ---------- */
function slideDown(el, dur) {
  dur = dur || 400;
  el.style.display = 'block';
  el.style.overflow = 'hidden';
  var h = el.scrollHeight;
  el.style.height = '0px';
  el.style.transition = 'height ' + dur + 'ms';
  requestAnimationFrame(function () {
    el.style.height = h + 'px';
  });
  setTimeout(function () {
    el.style.height = '';
    el.style.overflow = '';
    el.style.transition = '';
  }, dur + 50);
}
function slideUp(el, dur) {
  dur = dur || 400;
  el.style.overflow = 'hidden';
  el.style.height = el.scrollHeight + 'px';
  el.style.transition = 'height ' + dur + 'ms';
  requestAnimationFrame(function () {
    el.style.height = '0px';
  });
  setTimeout(function () {
    el.style.display = 'none';
    el.style.height = '';
    el.style.overflow = '';
    el.style.transition = '';
  }, dur + 50);
}
function copyToClipboard(text) {
  var t = document.createElement('textarea');
  document.body.appendChild(t);
  t.value = text;
  t.select();
  document.execCommand('copy');
  document.body.removeChild(t);
}

/* ---------- FAQ-collapse (var collapseContent + click-handler) ---------- */
function collapseContent() {
  document.querySelectorAll('.collapse').forEach(function (col) {
    if (col.querySelector('.collapse__item')) return;
    var count = 0;
    var children = Array.prototype.slice.call(col.children);
    var group = null;
    function flush() {
      if (!group) return;
      var item = document.createElement('div');
      item.className = 'collapse__item';
      var content = document.createElement('div');
      content.className = 'collapse__content';
      count += 1;
      group.h.setAttribute('data-count', '0' + count);
      while (group.nodes.length) content.appendChild(group.nodes.shift());
      item.appendChild(group.h);
      item.appendChild(content);
      col.appendChild(item);
      group = null;
    }
    Array.prototype.slice.call(col.children).forEach(function (el) {
      if (/^H[234]$/.test(el.tagName)) { flush(); group = { h: el, nodes: [el] }; }
      else if (group) group.nodes.push(el);
    });
    flush();
  });
}
function bindCollapseClicks() {
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('.collapse h3, .collapse summary, .mce-accordion summary') : null;
    if (!el) return;
    ev.preventDefault();
    var container = el.closest('.collapse__item, .mce-accordion');
    container = container ? container.closest('.grid-container') || document : document;
    var content = el.parentElement.querySelector('.collapse__content');
    if (!content) return;
    var isActive = el.classList.contains('active');
    container.querySelectorAll('.collapse__content').forEach(function (c) {
      if (c !== content && c.style.display !== 'none') slideUp(c);
    });
    container.querySelectorAll('h3, h2, summary').forEach(function (h) {
      if (h !== el) h.classList.remove('active');
    });
    if (isActive) { slideUp(content); el.classList.remove('active'); }
    else { slideDown(content); el.classList.add('active'); }
  });
}

/* ---------- Drawer / navigation (var NavigationController, vanilla) ---------- */
var NavigationController = (function () {
  var drawer, drawerOpenEls, visibleHeader;
  var prevScrollPos = window.scrollY;
  function toggleNavigation(state) {
    if (state === true) {
      document.documentElement.classList.toggle('drawer-active');
      drawer.classList.toggle('drawer--active');
      visibleHeader.classList.toggle('header--drawer-active');
    } else if (state === 'close') {
      document.documentElement.classList.remove('drawer-active');
      drawer.classList.remove('drawer--active');
      visibleHeader.classList.remove('header--drawer-active');
      drawer.querySelectorAll('.nav__item--has-children.expanded').forEach(function (li) {
        li.classList.remove('expanded');
        var items = li.querySelector('.nav__items');
        if (items) slideUp(items);
      });
    }
  }
  function handleHeaderVisibility() {
    var y = window.scrollY;
    if (prevScrollPos > y || y < 1) {
      visibleHeader.style.top = '0px';
      visibleHeader.classList.remove('header--hidden');
    } else if (window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 5) {
      visibleHeader.style.top = '0px';
      visibleHeader.classList.remove('header--hidden');
    } else if (prevScrollPos !== y) {
      visibleHeader.style.top = '-' + visibleHeader.offsetHeight + 'px';
      visibleHeader.classList.add('header--hidden');
    }
    prevScrollPos = y;
  }
  function handleHeaderScroll() {
    var y = window.scrollY;
    var bar = document.querySelector('.announcement-bar-container');
    var a = bar ? bar.offsetHeight : 0;
    var header = document.querySelector('.header');
    if (!header) return;
    if (y > 10 + a && header.classList.contains('header--scrolled') && !header.classList.contains('header--hidden')) {
      header.classList.add('header--scrolled');
    } else if (y > 60 + a && !header.classList.contains('header--hidden')) {
      header.classList.add('header--scrolled');
    } else if (y < 60 + a) {
      header.classList.remove('header--scrolled');
    }
  }
  function init() {
    drawer = document.querySelector('.drawer');
    if (!drawer) return;
    drawerOpenEls = document.querySelectorAll('.js-drawer-open');
    visibleHeader = document.querySelector('header');
    drawerOpenEls.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        toggleNavigation(true);
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    });
    window.addEventListener('click', function (e) {
      if (drawer.classList.contains('drawer--active') && !e.target.closest('.drawer')) toggleNavigation('close');
    });
    drawer.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  return {
    init: init,
    toggleNavigation: toggleNavigation,
    handleHeaderVisibility: handleHeaderVisibility,
    handleHeaderScroll: handleHeaderScroll
  };
})();

/* ---------- Højder: hero-slider min-height, drawer-højde, package-intros ---------- */
function resetHeight(force) {
  var header = document.querySelector('.header');
  var headerH = header ? header.offsetHeight : 0;
  var bar = document.querySelector('.announcement-bar-container');
  var barH = bar ? bar.offsetHeight : 0;
  var isFixed = header && !header.classList.contains('header--fixed');
  var headerHFixed = header ? header.offsetHeight : 0;
  if (!force) {
    document.querySelectorAll('.hero-slider').forEach(function (el) {
      el.style.minHeight = 'calc(' + window.innerHeight + 'px - ' + headerHFixed + 'px - ' + barH + 'px)';
    });
  }
  document.querySelectorAll('.drawer').forEach(function (d) {
    d.style.height = 'calc(' + window.innerHeight + 'px - ' + headerHFixed + 'px)';
  });
  setTimeout(function () {
    var hh = document.querySelector('.header');
    var h = hh ? hh.offsetHeight : 0;
    document.querySelectorAll('.drawer').forEach(function (d) {
      d.style.height = 'calc(' + window.innerHeight + 'px - ' + h + 'px)';
    });
  }, 600);
}
function equalizePackageIntros() {
  var groups = {};
  document.querySelectorAll('.card--package .card__intro').forEach(function (el) {
    el.style.minHeight = '';
    var card = el.closest('.card--package');
    var top = card ? Math.round(card.getBoundingClientRect().top + window.scrollY) : 0;
    (groups[top] = groups[top] || []).push(el);
  });
  Object.keys(groups).forEach(function (top) {
    var max = 0;
    groups[top].forEach(function (el) {
      max = Math.max(max, el.offsetHeight);
    });
    groups[top].forEach(function (el) { el.style.minHeight = max + 'px'; });
  });
}
window.addEventListener('resize', function () { resetHeight(true); equalizePackageIntros(); });

/* ---------- Scroll-håndtering (rAF, som før) ---------- */
var ticking = false;
window.addEventListener('scroll', function () {
  if (!ticking) {
    window.requestAnimationFrame(function () {
      NavigationController.handleHeaderScroll();
      resetHeight(true);
      ticking = false;
    });
    ticking = true;
  }
});

/* ---------- In-view-observer (BubbleInView — uændret fra bundlen) ---------- */
!function () {
  "use strict";
  var t = { rootMargin: "-0px -0px -20px -0px", threshold: .1, toggle: !0, staggerContainerSelector: ".in-view-stagger", staggerDelay: 80, staggerRowTolerance: 12, scopeSelector: "[data-in-view-scope]", scopeTargets: "h1, h2, h3", scopeClass: "in-view--tilt-left" }, e = null;
  function r() { var e, r, n, i = t.threshold; return "number" != typeof i && (i = parseFloat(i)), isNaN(i) && (i = .1), n = 1, (e = i) < (r = 0) ? r : e > n ? n : e; }
  function n(t) { return function (t) { return null === t || void 0 === t ? "" : String(t); }(t).replace(/^\s+|\s+$/g, ""); }
  function i(t, e) { return !0 === t || !1 === t ? t : "" === t || 1 === t || "1" === t || "true" === t || 0 !== t && "0" !== t && "false" !== t && e; }
  function a() { return i(t.toggle, !0); }
  function o(t) { if (!t) return a(); var e = t.getAttribute("data-in-view-once"); if (null !== e) return !i(e, !0); var r = t.getAttribute("data-in-view-toggle"); return null !== r ? i(r, !0) : a(); }
  function l(e) { if (!e) return n(t.scopeTargets) || "h2"; var r = n(e.getAttribute("data-in-view-scope")); if (r) return r; var i = n(e.getAttribute("data-in-view-target")); return i || (n(t.scopeTargets) || "h2"); }
  function s(e) { if (!e) return n(t.scopeClass); var r = n(e.getAttribute("data-in-view-class")); return r || n(t.scopeClass); }
  function u(t, e) { if (t && t.classList) { t.classList.add("in-view"); var r = n(e); if (r) for (var i = r.split(/\s+/), a = 0; a < i.length; a++) { var o = i[a]; o && "in-view" !== o && "in-view--visible" !== o && t.classList.add(o); } } }
  function c() { var e = n(t.scopeSelector) || "[data-in-view-scope]"; if (e) { var r = null; try { r = document.querySelectorAll(e); } catch (t) { return; } if (r && 0 !== r.length) for (var i = 0; i < r.length; i++) { var a = r[i]; if (a) { var o = l(a); if (o) { var c = s(a), v = a.getAttribute("data-in-view-once"), g = a.getAttribute("data-in-view-toggle"), f = null; try { f = a.querySelectorAll(o); } catch (t) { continue; } if (f && 0 !== f.length) for (var d = 0; d < f.length; d++) { var h = f[d]; h && (null === h.getAttribute("data-in-view-ignore") && (h.classList && h.classList.contains("in-view") || (u(h, c), null !== v && null === h.getAttribute("data-in-view-once") && h.setAttribute("data-in-view-once", v), null !== g && null === h.getAttribute("data-in-view-toggle") && h.setAttribute("data-in-view-toggle", g)))); } } } } } }
  function v(t, e) { if (!t || 1 !== t.nodeType) return !1; var r = Element.prototype, n = r.matches || r.msMatchesSelector || r.webkitMatchesSelector; if (n) return n.call(t, e); for (var i = (t.document || t.ownerDocument).querySelectorAll(e), a = 0; a < i.length; a++) if (i[a] === t) return !0; return !1; }
  function g(t, e) { if (!t) return null; if (t.closest) return t.closest(e); for (var r = t; r && 1 === r.nodeType;) { if (v(r, e)) return r; r = r.parentElement; } return null; }
  function f(t, e) { if (t && t.style) try { t.style.setProperty("--in-view-delay", e + "ms"); } catch (t) { } }
  function d(n, i) { for (var a = [], l = [], s = [], u = r(), c = 0; c < n.length; c++) { var v = n[c]; if (v && v.target) { var d = "number" == typeof v.intersectionRatio ? v.intersectionRatio : 0, h = o(v.target); d >= u && v.isIntersecting ? (a.push(v.target), h || s.push(v.target)) : h && (!v.isIntersecting || d <= 0) && l.push(v.target); } } !function (e) { if (e && 0 !== e.length) { var r = t.staggerContainerSelector, n = parseInt(t.staggerDelay, 10) || 0, i = parseInt(t.staggerRowTolerance, 10) || 0; if (!r || !n || n <= 0) for (var a = 0; a < e.length; a++) f(e[a], 0); else { for (var o = [], l = 0; l < e.length; l++) { var s = e[l], u = g(s, r); u ? m(u).items.push(s) : f(s, 0); } for (var c = 0; c < o.length; c++) { var v = o[c].items; if (v && 0 !== v.length) { for (var d = [], h = 0; h < v.length; h++) { var p = v[h].getBoundingClientRect(); d.push({ el: v[h], top: Math.round(p.top || 0), left: Math.round(p.left || 0) }); } d.sort(function (t, e) { return t.top !== e.top ? t.top - e.top : t.left - e.left; }); for (var w = null, b = 0, y = 0; y < d.length; y++) { var A = d[y].top; null === w ? (w = A, b = 0) : i > 0 && Math.abs(A - w) > i && (w = A, b = 0), f(d[y].el, b * n), b++; } } } } } function m(t) { for (var e = 0; e < o.length; e++) if (o[e].container === t) return o[e]; var r = { container: t, items: [] }; return o.push(r), r; } }(a); for (var p = 0; p < l.length; p++) l[p].classList.remove("in-view--visible"); for (var w = 0; w < a.length; w++) a[w].classList.add("in-view--visible"); var b = i || e; if (b && s.length) for (var y = 0; y < s.length; y++) b.unobserve(s[y]); }
  function h() { var n; return !e && "IntersectionObserver" in window && (e = new IntersectionObserver(d, { root: null, rootMargin: t.rootMargin, threshold: (n = r(), n <= 0 ? [0] : [0, n]) })), e; }
  function p() { var t = document.querySelectorAll(".in-view"); if (t && 0 !== t.length) if ("IntersectionObserver" in window) for (var e = h(), r = 0; r < t.length; r++) { var n = t[r]; n && "true" !== n.getAttribute("data-in-view-observed") && (n.setAttribute("data-in-view-observed", "true"), e.observe(n)); } else for (var i = 0; i < t.length; i++) t[i].classList.add("in-view--visible"); }
  function w() { c(), p(); }
  "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", w, { once: !0 }) : w();
  window.BubbleInView = { refresh: function () { c(), p(); }, config: t };
}();

/* ---------- Billede-load → genopfrisk in-view ---------- */
var imgRefreshTimeout;
document.querySelectorAll("img").forEach(function (el) {
  el.addEventListener("load", function () {
    clearTimeout(imgRefreshTimeout);
    imgRefreshTimeout = setTimeout(function () {
      if (typeof BubbleInView !== "undefined") BubbleInView.refresh();
    }, 200);
  });
});

/* ---------- Sliders (Swiper ligger nu i swiper.js) ---------- */
function initSliders() {
  if (typeof Swiper === "undefined") return;
  document.querySelectorAll(".section-slider, .sidebar-slider").forEach(function (el) {
    var p = el.parentElement;
    new Swiper(el, {
      watchOverflow: true, loop: false, watchSlidesProgress: true, slideToClickedSlide: true,
      autoplay: { delay: 5000 }, effect: "fade",
      pagination: { el: p.querySelector(".swiper-pagination"), clickable: true },
      navigation: { nextEl: p.querySelector(".swiper-button-next"), prevEl: p.querySelector(".swiper-button-prev") },
      scrollbar: { el: p.querySelector(".swiper-scrollbar"), draggable: true }
    });
  });
  document.querySelectorAll(".hero-slider").forEach(function (el) {
    new Swiper(el, { autoplay: { delay: 5000 }, effect: "fade" });
  });
  document.querySelectorAll(".statement-slider").forEach(function (el) {
    var p = el.parentElement;
    new Swiper(el, {
      watchOverflow: true, loop: false, slidesPerView: 1, slidesPerGroup: 1, spaceBetween: 20, autoHeight: true,
      pagination: { el: p.querySelector(".swiper-pagination"), clickable: true },
      navigation: { nextEl: p.querySelector(".swiper-button-next"), prevEl: p.querySelector(".swiper-button-prev") },
      on: { slideChange: function () { if (typeof BubbleInView !== "undefined") BubbleInView.refresh(); } }
    });
  });
  document.querySelectorAll(".packages-slider").forEach(function (el) {
    var p = el.parentElement;
    new Swiper(el, {
      watchOverflow: true, loop: false, slidesPerView: 1.2, slidesPerGroup: 1, spaceBetween: 20,
      pagination: { el: p.querySelector(".swiper-pagination"), clickable: true },
      navigation: { nextEl: p.querySelector(".swiper-button-next"), prevEl: p.querySelector(".swiper-button-prev") },
      breakpoints: { 640: { slidesPerView: 2.2, spaceBetween: 25, slidesPerGroup: 2 }, 900: { slidesPerView: 3.2, slidesPerGroup: 3, spaceBetween: 25 }, 1200: { slidesPerView: 4, slidesPerGroup: 4, spaceBetween: 25 } }
    });
  });
}

/* ---------- CookieScript-knapper ---------- */
function bindCookieScriptButtons() {
  document.querySelectorAll(".cookiescript-consent-element").forEach(function (el) {
    el.addEventListener("click", function () { if (window.CookieScript && window.CookieScript.instance) window.CookieScript.instance.show(); });
  });
  document.querySelectorAll("._CookieScriptReportPageCheckboxes").forEach(function (el) {
    el.addEventListener("click", function () { if (window.CookieScript && window.CookieScript.instance) window.CookieScript.instance.show(); });
  });
  document.querySelectorAll("._CookieScriptReportPageSaveSettingButton").forEach(function (el) {
    el.addEventListener("click", function () { el.classList.add("active"); });
  });
}

/* ---------- Globalt klik-bindings (smooth scroll m.m.) ---------- */
function bindGlobalClicks() {
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest ? ev.target.closest('a[href*="#"]') : null;
    if (!a) return;
    var parts = a.getAttribute("href").split("#");
    var id = parts[1];
    var target = null;
    if (id === "" || (document.body.getAttribute("data-link") || "").indexOf(parts[0]) !== -1) {
      target = id ? document.getElementById(id) : null;
    }
    if (target) {
      ev.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
      NavigationController.toggleNavigation("close");
      return false;
    }
  });
}

/* ---------- Init ---------- */
(function () {
  function domReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }
  domReady(function () {
    NavigationController.init();
    collapseContent();
    bindCollapseClicks();
    bindCookieScriptButtons();
    bindGlobalClicks();
    initSliders();
    resetHeight();
    setTimeout(resetHeight, 150);
    setTimeout(resetHeight, 1000);
    equalizePackageIntros();
    setTimeout(equalizePackageIntros, 500);
    /* tomme <p>-tags fjernes (som i bundlen) */
    document.querySelectorAll("p").forEach(function (p) {
      if (p.textContent.replace(/\u00A0/g, "").trim() === "") p.remove();
    });
    /* iframes i responsive-embed */
    document.querySelectorAll('iframe[src*="youtube"],iframe[src*="vimeo"]').forEach(function (f) {
      if (!f.closest(".responsive-embed")) {
        var w = document.createElement("div");
        w.className = "responsive-embed";
        f.parentNode.insertBefore(w, f);
        w.appendChild(f);
      }
    });
    /* eksterne links + pdf'er i nyt faneblad */
    document.querySelectorAll('nav a[href^="http"], a[href*=".pdf"], a.button[href^="http"]').forEach(function (a) {
      a.setAttribute("target", "_blank");
    });
    /* card--package: gem valgt pakke til tilbudsmotoren */
    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest ? ev.target.closest(".card--package .card__button") : null;
      if (!btn) return;
      var title = btn.getAttribute("data-package-title");
      if (title) Cookies.set("selected_package", title, { expires: 1, path: "/" });
    });
  });
})();
