#!/usr/bin/env python3
"""Faithful local mirror builder for karltoffel.dk.
Downloads all assets, self-hosts fonts, rewrites URLs to local relative paths.
Original markup/CSS/JS preserved verbatim; only URLs are rewritten."""
import os, re, sys, html, subprocess, urllib.parse

ROOT = "/Users/michaelplaibase/karltoffel"
SRC  = os.path.join(ROOT, "_source")
UA   = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
BASE = "https://karltoffel.dk/"

def curl(url, out, referer=BASE):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    r = subprocess.run(["curl","-sL","-A",UA,"-e",referer,url,"-o",out,
                        "-w","%{http_code} %{size_download}"],
                       capture_output=True, text=True)
    code, size = (r.stdout.strip().split() + ["?","?"])[:2]
    ok = code == "200" and size not in ("0","")
    print(f"  [{'OK ' if ok else 'ERR'}] {code} {size:>8}b  {url[:90]}")
    return ok, out

def read(p):
    with open(p, encoding="utf-8", errors="replace") as f: return f.read()
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(s)

# ---------------------------------------------------------------- 1. IMAGES
print("\n== DESIGN IMAGES ==")
design = ["appicon.png","favicon.png","karltoffel-logo-gul.svg","karltoffel-logo.svg",
          "kartoffelhalv-ny.png","texture.png","ikon_ristet.svg"]
for name in design:
    curl(BASE+"f/design/"+name, f"{ROOT}/assets/img/design/{name}")

print("\n== LEAFLET IMAGES ==")
for name in ["layers.png","layers-2x.png","marker-icon.png"]:
    curl(BASE+"images/"+name, f"{ROOT}/assets/img/leaflet/{name}")

# ---------------------------------------------------------------- 2. THUMBS
print("\n== THUMBNAILS ==")
htmltxt = read(f"{SRC}/index_raw.html")
# find all f/thumb urls with width; normalise &amp;
thumb_map = {}   # original-url-fragment -> local filename
for m in re.finditer(r'(/?f/thumb\?src=/f/blog/article/([0-9a-f]+)_thumb\.(jpg|png|jpeg)(?:&amp;|&)w=(\d+)(?:&amp;|&)webp)', htmltxt):
    frag, h, ext, w = m.group(1), m.group(2), m.group(3), m.group(4)
    local = f"{h}_w{w}.webp"
    if local not in thumb_map.values():
        real = BASE + f"f/thumb?src=/f/blog/article/{h}_thumb.{ext}&w={w}&webp"
        curl(real, f"{ROOT}/assets/img/thumb/{local}")
    thumb_map[frag] = local
print(f"  ({len(set(thumb_map.values()))} unique thumbnails)")

# ---------------------------------------------------------------- 3. FONTAWESOME
print("\n== FONTAWESOME ==")
for name in ["fa-brands-400.woff2","fa-brands-400.ttf",
             "fa-sharp-regular-400.woff2","fa-sharp-regular-400.ttf"]:
    curl(BASE+"assets/fontawesome/6.6.0/"+name,
         f"{ROOT}/assets/fonts/fontawesome/6.6.0/{name}")

# ---------------------------------------------------------------- 4. TYPEKIT
print("\n== TYPEKIT (snaga-unicase-display) ==")
tk = read(f"{SRC}/typekit.css")
# download woff2 for each @font-face (prefer woff2 'l' variant)
tk_new = tk
for i, m in enumerate(re.finditer(r'src:url\("(https://use\.typekit\.net/af/[^"]+)"\)\s*format\("woff2"\)', tk)):
    url = m.group(1)
    fname = f"snaga-{i}.woff2"
    curl(url, f"{ROOT}/assets/fonts/typekit/{fname}")
    # replace whole src: line for this face -> only local woff2
    tk_new = tk_new.replace(m.group(0), f'src:url("../fonts/typekit/{fname}") format("woff2")')
# drop the external p.css @import (metrics only; not needed offline)
tk_new = re.sub(r'@import url\("https://p\.typekit\.net[^"]*"\);', '', tk_new)
write(f"{ROOT}/assets/css/typekit.css", tk_new)

# ---------------------------------------------------------------- 5. HANKEN (google)
print("\n== HANKEN GROTESK (google) ==")
gfont_url = "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,100..900;1,100..900&display=swap"
ok, tmp = curl(gfont_url, f"{SRC}/hanken_raw.css")
hanken_css = read(tmp) if ok else ""
# download each woff2 in the google css, rewrite to local
def dl_google(css):
    idx = [0]
    def repl(m):
        u = m.group(1)
        fn = f"hanken-{idx[0]}.woff2"; idx[0]+=1
        curl(u, f"{ROOT}/assets/fonts/google/{fn}")
        return f'url(../fonts/google/{fn})'
    return re.sub(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', repl, css)
hanken_css = dl_google(hanken_css)
write(f"{ROOT}/assets/css/hanken-grotesk.css", hanken_css)

# ---------------------------------------------------------------- 6. STYLE.CSS
print("\n== REWRITE style.css ==")
css = read(f"{SRC}/style.css")
# replace google @import with local stylesheet import
css = re.sub(r'@import url\(https://fonts\.googleapis\.com/css2\?family=Hanken[^;]*\);',
             '@import url(hanken-grotesk.css);', css)
# fontawesome: assets/fontawesome/6.6.0/X  ->  ../fonts/fontawesome/6.6.0/X
css = css.replace('assets/fontawesome/6.6.0/', '../fonts/fontawesome/6.6.0/')
# design images (with and without leading slash)
css = css.replace('url(/f/design/', 'url(../img/design/')
css = css.replace('url(f/design/',  'url(../img/design/')
# leaflet images/  -> ../img/leaflet/
css = re.sub(r'url\((images/)', r'url(../img/leaflet/', css)
write(f"{ROOT}/assets/css/style.css", css)

# ---------------------------------------------------------------- 7. main.min.css + script.js (verbatim)
write(f"{ROOT}/assets/css/main.min.css", read(f"{SRC}/main.min.css"))
write(f"{ROOT}/assets/js/script.js", read(f"{SRC}/script.js"))

# ---------------------------------------------------------------- 8. INDEX.HTML
print("\n== REWRITE index.html ==")
doc = htmltxt
# 8a. remove <base href> so relative asset paths resolve locally
doc = re.sub(r'<base\s+href="[^"]*">\s*', '', doc)
# 8b. head assets
doc = doc.replace('/assets/css/main.min.css?9', 'assets/css/main.min.css')
doc = doc.replace('/style.css?282376887', 'assets/css/style.css')
doc = doc.replace('https://use.typekit.net/qfz3lyk.css', 'assets/css/typekit.css')
doc = re.sub(r'/script\.js\?\d+', 'assets/js/script.js', doc)
# 8c. thumbnails (longest fragments first to avoid partial clobber)
for frag in sorted(thumb_map, key=len, reverse=True):
    local = 'assets/img/thumb/' + thumb_map[frag]
    doc = doc.replace(frag, local)          # handles &amp; form as it appears in HTML
# 8d. design images
doc = re.sub(r'(?<=["\'(])/?f/design/', 'assets/img/design/', doc)
# 8e. internal navigation & form links -> absolute live URLs (keep them working)
#     root-relative /... and bare relative p/... c/... , form action
def abs_link(m):
    q = m.group(1); val = m.group(2)
    if re.match(r'(https?:|mailto:|tel:|javascript:|#|assets/|data:)', val): return m.group(0)
    if val.startswith('/'):  return f'{q}="https://karltoffel.dk{val}"'
    return f'{q}="https://karltoffel.dk/{val}"'
doc = re.sub(r'\b(href|action)="([^"]*)"', abs_link, doc)
# note banner
doc = doc.replace('<!doctype html>',
    '<!-- Faithful local mirror of https://karltoffel.dk/ (front page). '
    'Assets self-hosted; nav links point to the live site. -->\n<!doctype html>')
write(f"{ROOT}/index.html", doc)
print("\nDONE.")
