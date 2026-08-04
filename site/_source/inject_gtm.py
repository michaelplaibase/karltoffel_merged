#!/usr/bin/env python3
"""Injicér Google Tag Manager (GTM-P3RXDG98) i alle sidens HTML-filer.

Kørt én gang for at sætte GTM live — men scriptet er idempotent, så det kan
køres igen efter en genopbygning med build_mirror.py / build_pages.py (som
skriver siderne fra bunden og derfor fjerner GTM igen).

Placering pr. side:
  * head-snippet  → umiddelbart EFTER cookie-script-tagget. Så højt i <head>
    som muligt, men efter samtykke-banneret (CookieScript skal initialisere
    før GTM, ellers kender GTM ikke samtykke-status via Google Consent Mode)
    og efter kundetype-redirect-guarden på / og /p/forside/, så en besøgende
    der straks sendes videre til /erhverv ikke tæller som et sidevisning på
    forsiden.
  * noscript-snippet → umiddelbart efter <body ...>.

Kør fra site-mappen:  python3 _source/inject_gtm.py
"""
import os
import re
import sys

GTM_ID = "GTM-P3RXDG98"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HEAD_SNIPPET = (
    "\t<!-- Google Tag Manager -->\n"
    "\t<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});"
    "var f=d.getElementsByTagName(s)[0], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src= "
    "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f); })"
    "(window,document,'script','dataLayer','" + GTM_ID + "');</script>\n"
    "\t<!-- End Google Tag Manager -->\n"
)

BODY_SNIPPET = (
    "\t<!-- Google Tag Manager (noscript) -->\n"
    '\t<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=' + GTM_ID + '" '
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n'
    "\t<!-- End Google Tag Manager (noscript) -->\n"
)

COOKIE_SCRIPT_RE = re.compile(r'^.*cdn\.cookie-script\.com.*\n', re.MULTILINE)
BODY_OPEN_RE = re.compile(r'^<body\b[^>]*>[ \t]*\n', re.MULTILINE)


def pages():
    """Alle udgivne sider — _source/ er arkiv og skal ikke røres."""
    found = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ("_source", "assets", ".git", ".vercel")]
        for name in filenames:
            if name.endswith(".html"):
                found.append(os.path.join(dirpath, name))
    return sorted(found)


def inject(path):
    with open(path, encoding="utf-8") as f:
        doc = f.read()

    if GTM_ID in doc:
        return "skipped (findes allerede)"

    doc, n_head = COOKIE_SCRIPT_RE.subn(lambda m: m.group(0) + HEAD_SNIPPET, doc, count=1)
    if n_head != 1:
        return "FEJL: fandt ikke cookie-script-tagget i <head>"

    doc, n_body = BODY_OPEN_RE.subn(lambda m: m.group(0) + BODY_SNIPPET, doc, count=1)
    if n_body != 1:
        return "FEJL: fandt ikke <body>-tagget"

    with open(path, "w", encoding="utf-8") as f:
        f.write(doc)
    return "ok"


def main():
    files = pages()
    if not files:
        sys.exit("Ingen HTML-sider fundet — kør scriptet fra site-mappen.")

    failed = 0
    for path in files:
        result = inject(path)
        if result.startswith("FEJL"):
            failed += 1
        print(f"  [{result}] {os.path.relpath(path, ROOT)}")

    print(f"\n{len(files)} sider gennemgået, {failed} fejlede.")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
