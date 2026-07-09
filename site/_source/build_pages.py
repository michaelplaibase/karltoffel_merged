#!/usr/bin/env python3
"""Crawl + mirror ALL karltoffel.dk subpages into the local static site.
Reuses the already-downloaded CSS/JS/fonts. Downloads each page's new images,
rewrites every URL to local root-relative paths, saves as <path>/index.html.

Serving model: served from site root (e.g. `python3 -m http.server`).
- assets      -> /assets/...            (root-relative, work at any depth)
- page links  -> /p/... , /c/...        (root-relative; server redirects dir -> index.html)
- no <base>   -> in-page #anchors keep working
- external links (skat.dk, facebook, bubble, recaptcha, cookie-script) left as-is
"""
import os, re, subprocess

ROOT = "/Users/michaelplaibase/karltoffel"
SRC  = os.path.join(ROOT, "_source")
PAGES_RAW = os.path.join(SRC, "pages")
UA   = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
BASE = "https://karltoffel.dk/"

def sh(url, out, referer=BASE):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    r = subprocess.run(["curl","-sL","-A",UA,"-e",referer,url,"-o",out,
                        "-w","%{http_code} %{size_download}"], capture_output=True, text=True)
    code, size = (r.stdout.strip().split() + ["?","?"])[:2]
    return code == "200" and size not in ("0",""), code, size

def read(p):
    with open(p, encoding="utf-8", errors="replace") as f: return f.read()
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(s)

# ---- 1. URL list from sitemaps -------------------------------------------
def locs(path):
    if not os.path.exists(path): return []
    return re.findall(r'<loc>([^<]+)</loc>', read(path))
urls = set(locs(f"{SRC}/sitemap_pages.xml")) | set(locs(f"{SRC}/sitemap_blog.xml"))
urls = {u.rstrip('/') for u in urls if 'sitemap' not in u}
urls.discard("https://karltoffel.dk")          # front page already built
print(f"Pages to mirror: {len(urls)}")

def url_to_path(u):
    rel = u.replace(BASE, "").replace("https://karltoffel.dk/", "").strip("/")
    return rel                                   # e.g. 'p/om-karltoffel'

# ---- 2. download each page raw + discover extra internal links -----------
raw = {}   # url -> raw html
for u in sorted(urls):
    slug = url_to_path(u).replace("/", "__")
    out  = f"{PAGES_RAW}/{slug}.html"
    ok, code, size = sh(u, out)
    print(f"  [{'OK ' if ok else 'ERR'}] {code} {int(size):>7}b  {u}")
    if ok: raw[u] = read(out)

# discover internal links not in sitemap (e.g. privatlivspolitik)
extra = set()
for html_txt in raw.values():
    for m in re.finditer(r'(?:href|action)="(?:https://karltoffel\.dk)?/?((?:p|c)/[^"#?]+)"', html_txt):
        cand = "https://karltoffel.dk/" + m.group(1).rstrip('/')
        if cand not in raw and cand.rstrip('/') not in urls and cand != "https://karltoffel.dk":
            extra.add(cand)
for u in sorted(extra):
    slug = url_to_path(u).replace("/", "__")
    out  = f"{PAGES_RAW}/{slug}.html"
    ok, code, size = sh(u, out)
    print(f"  [extra {'OK ' if ok else 'ERR'}] {code} {int(size):>7}b  {u}")
    if ok: raw[u] = read(out); urls.add(u)

# ---- 3. collect + download all NEW thumbnails ----------------------------
thumb_dir = f"{ROOT}/assets/img/thumb"
have = set(os.listdir(thumb_dir))
thumb_re = re.compile(r'/?f/thumb\?src=/f/(?:blog/article|page)/([0-9a-f]+)_thumb\.(jpg|jpeg|png)(?:&amp;|&)w=(\d+)(?:&amp;|&)webp')
new_thumbs = 0
for html_txt in raw.values():
    for h, ext, w in {(m.group(1), m.group(2), m.group(3)) for m in thumb_re.finditer(html_txt)}:
        local = f"{h}_w{w}.webp"
        if local not in have:
            real = BASE + f"f/thumb?src=/f/blog/article/{h}_thumb.{ext}&w={w}&webp"
            ok, code, size = sh(real, f"{thumb_dir}/{local}")
            if ok: have.add(local); new_thumbs += 1
            else:  print(f"    thumb ERR {code} {local}")
print(f"New thumbnails downloaded: {new_thumbs}")

# any f/design not present? (shared set already downloaded; grab stragglers)
design_dir = f"{ROOT}/assets/img/design"
have_d = set(os.listdir(design_dir))
for html_txt in raw.values():
    for name in set(re.findall(r'/?f/design/([A-Za-z0-9_.-]+\.(?:png|jpg|jpeg|svg|webp|gif))', html_txt)):
        if name not in have_d:
            ok, code, size = sh(BASE+"f/design/"+name, f"{design_dir}/{name}")
            if ok: have_d.add(name); print(f"    +design {name}")

# ---- 4. rewrite one page's HTML to local root-relative -------------------
def rewrite(doc):
    doc = re.sub(r'<base\s+href="[^"]*">\s*', '', doc)          # drop base
    # css / js -> /assets
    doc = re.sub(r'/?assets/css/main\.min\.css\?\d+', '/assets/css/main.min.css', doc)
    doc = re.sub(r'/style\.css\?\d+', '/assets/css/style.css', doc)
    doc = doc.replace('https://use.typekit.net/qfz3lyk.css', '/assets/css/typekit.css')
    doc = re.sub(r'/script\.js\?\d+', '/assets/js/script.js', doc)
    # thumbnails -> /assets/img/thumb/<hash>_w<W>.webp
    def th(m):
        return f'/assets/img/thumb/{m.group(1)}_w{m.group(3)}.webp'
    doc = thumb_re.sub(th, doc)
    # design images -> /assets/img/design/
    doc = re.sub(r'(?<=["\'(])/?f/design/', '/assets/img/design/', doc)
    # internal nav/form links -> root-relative; leave external/mailto/tel/#/assets
    def link(m):
        q, val = m.group(1), m.group(2)
        if re.match(r'(https?:|mailto:|tel:|javascript:|#|/assets/|data:)', val):
            if val.startswith('https://karltoffel.dk/'):
                return f'{q}="{val[len("https://karltoffel.dk"):]}"'   # -> /path
            return m.group(0)
        if val.startswith('/'): return m.group(0)                       # already root-rel
        return f'{q}="/{val}"'                                          # bare rel -> /rel
    doc = re.sub(r'\b(href|action)="([^"]*)"', link, doc)
    return doc

# ---- 5. write each subpage as <path>/index.html --------------------------
for u in sorted(raw):
    rel = url_to_path(u)
    out = f"{ROOT}/{rel}/index.html"
    write(out, rewrite(raw[u]))
    print(f"  wrote {rel}/index.html")

# ---- 6. fix the EXISTING front page (preserve section edits) -------------
# front page currently has absolute https://karltoffel.dk/<path> nav links + relative assets.
fp = read(f"{ROOT}/index.html")
fp = re.sub(r'\b(href|action)="https://karltoffel\.dk(/(?:p|c)/[^"]*)"', r'\1="\2"', fp)
fp = re.sub(r'\b(href|action)="https://karltoffel\.dk/"', r'\1="/"', fp)
# make front-page asset refs root-relative too (uniform; still valid at root)
fp = re.sub(r'(href|src)="assets/', r'\1="/assets/', fp)
write(f"{ROOT}/index.html", fp)
print("  fixed front page links")
print("\nDONE.")
