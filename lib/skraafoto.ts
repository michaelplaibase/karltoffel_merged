/* ==========================================================================
   Karltoffel CRM — Skråfoto (Dataforsyningen STAC API v2).
   --------------------------------------------------------------------------
   Port af sitets tilbudsmotor-integration (assets/js/skraafoto.js), afkoblet
   fra #tilbudsmotor-DOM'en så den kan bruges i CRM'et: alt tager (canvas,
   adresse, token) som parametre i stedet for at læse faste element-id'er.

   Pipeline (Level B): adresse → koordinat (DAWA, WGS84 + EPSG:25832) →
   nærmeste skråfoto (STAC /search) → terrænhøjde (DHM WCS) → projicér
   ejendommens punkt til pixel (kollinearitet, saul getImageXY) → crop COG'en
   om huset og markér det. Al fejl fanges → kaster kun "stale"/render-fejl som
   kalderen kan vise som fallback.

   Kræver GeoTIFF i browseren; loadGeoTIFF() henter den vendored min-fil.
   Kun til brug i klient-komponenter (bruger window/document/canvas).
   ========================================================================== */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SkraafotoConfig = {
  token: string;
  stacBase: string;
  dawaBase: string;
  dhmWcsBase: string;
  collections: string[];
  direction: string;
  cropSpanPx: number;
};

/** Endpoints verificeret live 03.07.2026 (samme som sitets tilbudsmotor). */
export const SKRAAFOTO_ENDPOINTS = {
  stacBase: "https://api.dataforsyningen.dk/rest/skraafoto_api/v2",
  dawaBase: "https://api.dataforsyningen.dk",
  dhmWcsBase: "https://api.dataforsyningen.dk/dhm_wcs_DAF",
  collections: ["skraafotos2025", "skraafotos2023", "skraafotos2021"],
  direction: "north",
  cropSpanPx: 1400,
};

export function makeConfig(token: string, over: Partial<SkraafotoConfig> = {}): SkraafotoConfig {
  return { token, ...SKRAAFOTO_ENDPOINTS, ...over };
}

export const DIR_DA: Record<string, string> = {
  north: "nord", south: "syd", east: "øst", west: "vest", nadir: "lodret",
};
export const VERIFY_DIRS = ["north", "east", "south", "west"];
const YEAR_RE = /(\d{4})/;

/* ---- GeoTIFF loader: henter den vendored min-fil én gang ---- */
let geotiffPromise: Promise<any> | null = null;
export function loadGeoTIFF(src = "/vendor/geotiff.min.js"): Promise<any> {
  const w = window as any;
  if (w.GeoTIFF) return Promise.resolve(w.GeoTIFF);
  if (geotiffPromise) return geotiffPromise;
  geotiffPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-geotiff="1"]');
    const done = () => (w.GeoTIFF ? resolve(w.GeoTIFF) : reject(new Error("GeoTIFF loadede ikke")));
    if (existing) { existing.addEventListener("load", done); existing.addEventListener("error", () => reject(new Error("GeoTIFF-script fejlede"))); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true; s.dataset.geotiff = "1";
    s.onload = done;
    s.onerror = () => reject(new Error("GeoTIFF-script fejlede"));
    document.head.appendChild(s);
  });
  return geotiffPromise;
}
function GT(): any {
  const w = window as any;
  if (!w.GeoTIFF) throw new Error("GeoTIFF mangler");
  return w.GeoTIFF;
}

function tokenParam(cfg: SkraafotoConfig) { return "token=" + encodeURIComponent(cfg.token || ""); }

/* ================== GEO-TYPER ================== */
type Ring = number[][];
type Bbox = [number, number, number, number];
export type Geo = { id: string; lon: number; lat: number; X: number; Y: number; betegnelse: string };
type Parcel = { ring: Ring; centroid: [number, number]; matrikelnr: string; registreretareal?: number };
type Building = { ring: Ring; center: [number, number]; area: number };
type Item = { id: string; collection: string; direction: string; href: string | undefined; props: any; W: number; H: number };

/* ---- 1) Adresse → koordinat (WGS84 til STAC, EPSG:25832 til projektion) ---- */
export function geocode(adresse: string, cfg: SkraafotoConfig): Promise<Geo> {
  const base = cfg.dawaBase + "/adgangsadresser?per_side=1&struktur=mini&q=" + encodeURIComponent(adresse);
  const asJson = (r: Response) => { if (!r.ok) throw new Error("DAWA " + r.status); return r.json(); };
  return Promise.all([
    fetch(base).then(asJson),
    fetch(base + "&srid=25832").then(asJson),
  ]).then((res) => {
    const a = res[0] && res[0][0], b = res[1] && res[1][0];
    if (!a || !b) throw new Error("Ingen adresse-match");
    return { id: a.id, lon: a.x, lat: a.y, X: b.x, Y: b.y, betegnelse: a.betegnelse || adresse };
  });
}

/* ---- 1b) Adresse-id → matrikel-polygon (grund) i EPSG:25832 ---- */
function getParcel(id: string | undefined, cfg: SkraafotoConfig): Promise<Parcel | null> {
  if (!id) return Promise.resolve(null);
  return fetch(cfg.dawaBase + "/adgangsadresser/" + id)
    .then((r) => { if (!r.ok) throw 0; return r.json(); })
    .then((adr: any) => {
      const j = adr.jordstykke || {};
      const ejerlav = j.ejerlav && j.ejerlav.kode, matr = j.matrikelnr;
      if (!ejerlav || !matr) return null;
      return fetch(cfg.dawaBase + "/jordstykker/" + ejerlav + "/" + matr + "?format=geojson&srid=25832")
        .then((r) => { if (!r.ok) throw 0; return r.json(); })
        .then((gj: any) => {
          const f0 = gj.features && gj.features[0];
          const g = gj.geometry || (f0 && f0.geometry);
          if (!g) return null;
          const props = gj.properties || (f0 && f0.properties) || {};
          const ring: Ring = g.type === "MultiPolygon" ? g.coordinates[0][0] : g.coordinates[0];
          let cx = 0, cy = 0;
          ring.forEach((p) => { cx += p[0]; cy += p[1]; });
          return { ring, centroid: [cx / ring.length, cy / ring.length] as [number, number], matrikelnr: matr, registreretareal: props.registreretareal };
        });
    })
    .catch(() => null);
}

/* ---- 1c) Adresse-id → bygningens fodaftryk + visueltcenter (EPSG:25832) ---- */
function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}
function getBuilding(id: string | undefined, cfg: SkraafotoConfig): Promise<Building | null> {
  if (!id) return Promise.resolve(null);
  return fetch(cfg.dawaBase + "/bygninger?adgangsadresseid=" + id + "&format=geojson&srid=25832")
    .then((r) => { if (!r.ok) throw 0; return r.json(); })
    .then((gj: any) => {
      const feats = (gj && gj.features) || [];
      if (!feats.length) return null;
      let best: any = null, bestA = -1, bestRing: Ring | null = null;
      feats.forEach((f: any) => {
        const g = f.geometry; if (!g) return;
        const ring: Ring = g.type === "MultiPolygon" ? g.coordinates[0][0] : g.coordinates[0];
        const a = ringArea(ring);
        if (a > bestA) { bestA = a; best = f; bestRing = ring; }
      });
      if (!bestRing) return null;
      const ring: Ring = bestRing;
      const pr = best.properties || {};
      let cx = pr.visueltcenter_x, cy = pr.visueltcenter_y;
      if (cx == null || cy == null) {
        cx = 0; cy = 0; ring.forEach((p) => { cx += p[0]; cy += p[1]; });
        cx /= ring.length; cy /= ring.length;
      }
      return { ring, center: [cx, cy] as [number, number], area: bestA };
    })
    .catch(() => null);
}

/* ================== MÅLING (nDSM) ================== */
function ringPerimeter(ring: Ring): number {
  let p = 0;
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i - 1][0], dy = ring[i][1] - ring[i - 1][1];
    p += Math.sqrt(dx * dx + dy * dy);
  }
  return p;
}
function ringBbox(ring: Ring): Bbox {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function pointInPoly(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pctl(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.max(0, Math.min(a.length - 1, Math.round(p * (a.length - 1))))];
}
function median(arr: number[]): number | null { return pctl(arr, 0.5); }

type Grid = { data: any; w: number; h: number; bbox: Bbox };
/** DHM-dækning (dhm_terraen | dhm_overflade) som float32-gitter over bbox. */
function fetchGrid(coverage: string, bbox: Bbox, cfg: SkraafotoConfig): Promise<Grid> {
  const w = Math.max(16, Math.min(300, Math.round((bbox[2] - bbox[0]) / 0.4)));
  const h = Math.max(16, Math.min(300, Math.round((bbox[3] - bbox[1]) / 0.4)));
  const url = cfg.dhmWcsBase + "?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=" + coverage +
    "&CRS=epsg:25832&RESPONSE_CRS=epsg:25832&FORMAT=GTiff&WIDTH=" + w + "&HEIGHT=" + h +
    "&BBOX=" + bbox.join(",") + "&" + tokenParam(cfg);
  return fetch(url)
    .then((r) => { if (!r.ok) throw new Error("DHM " + r.status); return r.arrayBuffer(); })
    .then((buf) => GT().fromArrayBuffer(buf))
    .then((t: any) => t.getImage())
    .then((img: any) => img.readRasters().then((ras: any) => ({ data: ras[0], w: img.getWidth(), h: img.getHeight(), bbox })));
}
function sampleGrid(g: Grid, X: number, Y: number): number {
  const col = Math.floor((X - g.bbox[0]) / (g.bbox[2] - g.bbox[0]) * g.w);
  const row = Math.floor((g.bbox[3] - Y) / (g.bbox[3] - g.bbox[1]) * g.h); // GeoTIFF: række 0 = nord
  if (col < 0 || col >= g.w || row < 0 || row >= g.h) return NaN;
  return g.data[row * g.w + col];
}

type ParcelBuilding = { ring: Ring; area: number; perimeter: number };
/** Alle bygninger på grunden (hovedhus + skure/carporte), filtreret via matrikel-polygon. */
function getBuildingsOnParcel(centroid: [number, number], parcelRing: Ring, cfg: SkraafotoConfig): Promise<ParcelBuilding[]> {
  const bb = ringBbox(parcelRing);
  const R = Math.max(30, 0.75 * Math.max(bb[2] - bb[0], bb[3] - bb[1]) + 15);
  const url = cfg.dawaBase + "/bygninger?cirkel=" + Math.round(centroid[0]) + "," + Math.round(centroid[1]) +
    "," + Math.round(R) + "&format=geojson&srid=25832";
  return fetch(url)
    .then((r) => { if (!r.ok) throw 0; return r.json(); })
    .then((gj: any) => {
      const out: ParcelBuilding[] = [];
      ((gj && gj.features) || []).forEach((f: any) => {
        const g = f.geometry; if (!g) return;
        const ring: Ring = g.type === "MultiPolygon" ? g.coordinates[0][0] : g.coordinates[0];
        const pr = f.properties || {};
        let cx = pr.visueltcenter_x, cy = pr.visueltcenter_y;
        if (cx == null) { cx = 0; cy = 0; ring.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= ring.length; cy /= ring.length; }
        if (pointInPoly(cx, cy, parcelRing)) out.push({ ring, area: ringArea(ring), perimeter: ringPerimeter(ring) });
      });
      return out;
    })
    .catch(() => []);
}

export type Measurement = {
  grundAreal: number; grundOmkreds: number; bygningsAreal: number; haveAreal: number;
  antalBygninger: number; haekLangde: number;
  tagAreal?: number; tagOmkreds?: number; tagrendeLangde?: number;
  rygHojde?: number; tagfodHojde?: number; taghaeldning?: number; tagArealSkraat?: number;
  haekHojde?: number;
};

export function measureProperty(adresse: string, cfg: SkraafotoConfig): Promise<Measurement | null> {
  if (!cfg.token) return Promise.resolve(null);
  // Højde-/tag-målingerne kræver GeoTIFF (DHM-gitre). Load den først; fejler den,
  // fortsætter vi med de rene polygon-mål (grund/have/bygning) via .catch i grid-kaldene.
  return loadGeoTIFF().catch(() => null).then(() => geocode(adresse, cfg)).then((geo) => {
    return getParcel(geo.id, cfg).then((parcel) => {
      if (!parcel) return null;
      const pbb = ringBbox(parcel.ring), mg = 6;
      const bbox: Bbox = [pbb[0] - mg, pbb[1] - mg, pbb[2] + mg, pbb[3] + mg];
      return Promise.all([
        getBuildingsOnParcel(parcel.centroid, parcel.ring, cfg),
        fetchGrid("dhm_terraen", bbox, cfg).catch(() => null),
        fetchGrid("dhm_overflade", bbox, cfg).catch(() => null),
      ]).then((res) => {
        const buildings = res[0], dtm = res[1], dsm = res[2];
        const ndsm = (X: number, Y: number) => {
          if (!dtm || !dsm) return NaN;
          const a = sampleGrid(dsm, X, Y), b = sampleGrid(dtm, X, Y);
          return (isFinite(a) && isFinite(b)) ? a - b : NaN;
        };
        const grundAreal = parcel.registreretareal || ringArea(parcel.ring);
        const grundOmkreds = ringPerimeter(parcel.ring);
        const bygningsAreal = buildings.reduce((s, b) => s + b.area, 0);
        const m: Measurement = {
          grundAreal: Math.round(grundAreal),
          grundOmkreds: Math.round(grundOmkreds),
          bygningsAreal: Math.round(bygningsAreal),
          haveAreal: Math.max(0, Math.round(grundAreal - bygningsAreal)),
          antalBygninger: buildings.length,
          haekLangde: Math.round(grundOmkreds), // øvre grænse; kunden kan justere
        };
        const main = buildings.slice().sort((a, b) => b.area - a.area)[0];
        if (main) {
          m.tagAreal = Math.round(main.area);
          m.tagOmkreds = Math.round(main.perimeter);
          m.tagrendeLangde = Math.round(main.perimeter * 0.6); // tagfod ≈ 60% af omkreds (saddeltag)
          if (dtm && dsm && dsm.w === dtm.w && dsm.h === dtm.h) {
            const W = dsm.w, Hh = dsm.h, bx0 = dsm.bbox[0], by1 = dsm.bbox[3];
            const csx = (dsm.bbox[2] - dsm.bbox[0]) / W, csy = (dsm.bbox[3] - dsm.bbox[1]) / Hh;
            const bb = ringBbox(main.ring);
            const c0 = Math.max(1, Math.floor((bb[0] - bx0) / csx)), c1 = Math.min(W - 2, Math.ceil((bb[2] - bx0) / csx));
            const r0 = Math.max(1, Math.floor((by1 - bb[3]) / csy)), r1 = Math.min(Hh - 2, Math.ceil((by1 - bb[1]) / csy));
            const heights: number[] = [], slopes: number[] = [];
            for (let r = r0; r <= r1; r++) {
              for (let c = c0; c <= c1; c++) {
                const Xc = bx0 + (c + 0.5) * csx, Yc = by1 - (r + 0.5) * csy;
                if (!pointInPoly(Xc, Yc, main.ring)) continue;
                const idx = r * W + c, nd = dsm.data[idx] - dtm.data[idx];
                if (!(nd > 1)) continue; // kun tag (over terræn)
                heights.push(nd);
                const dzdx = (dsm.data[idx + 1] - dsm.data[idx - 1]) / (2 * csx);
                const dzdy = (dsm.data[idx - W] - dsm.data[idx + W]) / (2 * csy);
                slopes.push(Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180 / Math.PI);
              }
            }
            if (heights.length > 5) {
              m.rygHojde = Math.round((pctl(heights, 0.97) as number) * 10) / 10;
              m.tagfodHojde = Math.round((pctl(heights, 0.15) as number) * 10) / 10;
              const pitch = Math.max(0, Math.min(60, median(slopes) as number));
              m.taghaeldning = Math.round(pitch);
              m.tagArealSkraat = Math.round(main.area / Math.cos(pitch * Math.PI / 180));
            }
          }
        }
        if (dtm && dsm) {
          const hv: number[] = [];
          for (let i = 1; i < parcel.ring.length; i++) {
            const ax = parcel.ring[i - 1][0], ay = parcel.ring[i - 1][1];
            const bx = parcel.ring[i][0], by = parcel.ring[i][1];
            const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 2));
            for (let s = 0; s < n; s++) {
              const t = s / n, hh2 = ndsm(ax + (bx - ax) * t, ay + (by - ay) * t);
              if (isFinite(hh2) && hh2 > 0.4 && hh2 < 3.5) hv.push(hh2);
            }
          }
          const hm = median(hv);
          if (hm != null) m.haekHojde = Math.round(hm * 10) / 10;
        }
        return m;
      });
    });
  }).catch(() => null);
}

/* ---- 2) Koordinat → bedste skråfoto-item via STAC /search ---- */
function findItem(lon: number, lat: number, direction: string | undefined, cfg: SkraafotoConfig): Promise<Item> {
  const collections = cfg.collections || [];
  const want = direction || cfg.direction || "north";

  function tryCollection(i: number): Promise<Item> {
    if (i >= collections.length) throw new Error("Ingen skråfoto-dækning");
    const body = { collections: [collections[i]], intersects: { type: "Point", coordinates: [lon, lat] }, limit: 40 };
    return fetch(cfg.stacBase + "/search?" + tokenParam(cfg), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => { if (!r.ok) throw new Error("STAC " + r.status); return r.json(); })
      .then((fc: any) => {
        const feats = (fc && fc.features) || [];
        const oblique = feats.filter((f: any) => f.properties && f.properties.direction && f.properties.direction !== "nadir");
        if (!oblique.length) return tryCollection(i + 1);
        const pick = oblique.filter((f: any) => f.properties.direction === want)[0] || oblique[0];
        const io = pick.properties["pers:interior_orientation"] || {};
        const dim = io.sensor_array_dimensions || [14144, 10560];
        return {
          id: pick.id,
          collection: collections[i],
          direction: pick.properties.direction,
          href: pick.assets && pick.assets.data && pick.assets.data.href,
          props: pick.properties,
          W: dim[0], H: dim[1],
        };
      });
  }
  return tryCollection(0);
}

/* ---- 3) Terrænhøjde Z (m, DVR90) via DHM WCS — falder tilbage til 0 ---- */
function terrainZ(X: number, Y: number, cfg: SkraafotoConfig): Promise<number> {
  if (!cfg.dhmWcsBase) return Promise.resolve(0);
  const d = 3, bbox = [Math.round(X) - d, Math.round(Y) - d, Math.round(X) + d, Math.round(Y) + d].join(",");
  const url = cfg.dhmWcsBase +
    "?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=dhm_terraen" +
    "&CRS=epsg:25832&RESPONSE_CRS=epsg:25832&FORMAT=GTiff&WIDTH=3&HEIGHT=3&BBOX=" + bbox +
    "&" + tokenParam(cfg);
  return fetch(url)
    .then((r) => { if (!r.ok) throw new Error("DHM " + r.status); return r.arrayBuffer(); })
    .then((buf) => GT().fromArrayBuffer(buf))
    .then((t: any) => t.getImage())
    .then((img: any) => img.readRasters())
    .then((rasters: any) => {
      const band = rasters[0], v = band[Math.floor(band.length / 2)];
      return (isFinite(v) && v > -1000 && v < 500) ? v : 0;
    })
    .catch(() => 0);
}

/* ---- 4) Verden (X,Y,Z, EPSG:25832) → billed-pixel. Port af saul getImageXY ---- */
function rad(deg: number) { return deg * Math.PI / 180; }
function getImageXY(props: any, X: number, Y: number, Z: number): [number, number] {
  const io = props["pers:interior_orientation"];
  const xx0 = io.principal_point_offset[0], yy0 = io.principal_point_offset[1];
  const ci = io.focal_length, pix = io.pixel_spacing[0];
  const dimXi = io.sensor_array_dimensions[0], dimYi = io.sensor_array_dimensions[1];
  const pc = props["pers:perspective_center"];
  const X0 = pc[0], Y0 = pc[1], Z0 = pc[2];
  const o = rad(props["pers:omega"]), p = rad(props["pers:phi"]), k = rad(props["pers:kappa"]);
  const c = -ci, dimX = -dimXi * pix / 2, dimY = -dimYi * pix / 2;
  const D11 = Math.cos(p) * Math.cos(k), D12 = -Math.cos(p) * Math.sin(k), D13 = Math.sin(p);
  const D21 = Math.cos(o) * Math.sin(k) + Math.sin(o) * Math.sin(p) * Math.cos(k);
  const D22 = Math.cos(o) * Math.cos(k) - Math.sin(o) * Math.sin(p) * Math.sin(k);
  const D23 = -Math.sin(o) * Math.cos(p);
  const D31 = Math.sin(o) * Math.sin(k) - Math.cos(o) * Math.sin(p) * Math.cos(k);
  const D32 = Math.sin(o) * Math.cos(k) + Math.cos(o) * Math.sin(p) * Math.sin(k);
  const D33 = Math.cos(o) * Math.cos(p);
  const den = D13 * (X - X0) + D23 * (Y - Y0) + D33 * (Z - Z0);
  const x_dot = -c * ((D11 * (X - X0) + D21 * (Y - Y0) + D31 * (Z - Z0)) / den);
  const y_dot = -c * ((D12 * (X - X0) + D22 * (Y - Y0) + D32 * (Z - Z0)) / den);
  return [
    Math.round(((x_dot - xx0) + dimX) * (-1) / pix),
    Math.round(((y_dot - yy0) + dimY) * (-1) / pix),
  ];
}

/* saul's getImageXY returnerer rækken med BUND-origo (OpenLayers y-op).
   geotiff.js/canvas er TOP-origo, så rækken skal spejles: row = H - row_saul.
   Uden dette lander alt spejlet om billedets vandrette midterlinje. */
function projectRaster(item: Item, X: number, Y: number, Z: number): [number, number] {
  const p = getImageXY(item.props, X, Y, Z);
  return [p[0], item.H - p[1]];
}

/* ---- 5) COG → canvas ---- */
type Pt = { col: number; row: number };
type CanvasPt = { x: number; y: number };
type RenderOpts = { frame?: Pt[] | null; building?: Pt[] | null; parcel?: Pt[] | null; center?: Pt | null; spanPx?: number; canvasW?: number };

function yiq(raster: any, k: number, rgba: Uint8ClampedArray, j: number) {
  const Y = raster[k], Cb = raster[k + 1] - 128, Cr = raster[k + 2] - 128;
  rgba[j] = Y + 1.402 * Cr;
  rgba[j + 1] = Y - 0.344136 * Cb - 0.714136 * Cr;
  rgba[j + 2] = Y + 1.772 * Cb;
}

function drawShape(ctx: CanvasRenderingContext2D, pts: CanvasPt[], W: number, bold: boolean) {
  if (!pts || pts.length < 3) return;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.closePath();
  if (bold) {
    ctx.fillStyle = "rgba(255,248,123,0.15)"; ctx.fill();
    ctx.lineWidth = Math.max(4.5, W * 0.008); ctx.strokeStyle = "rgba(76,55,24,0.85)"; ctx.stroke();
    ctx.lineWidth = Math.max(2.5, W * 0.005); ctx.strokeStyle = "rgba(255,248,123,0.98)"; ctx.stroke();
  } else {
    ctx.setLineDash([Math.max(7, W * 0.014), Math.max(6, W * 0.011)]);
    ctx.lineWidth = Math.max(2, W * 0.0045); ctx.strokeStyle = "rgba(76,55,24,0.55)"; ctx.stroke();
    ctx.lineWidth = Math.max(1.5, W * 0.003); ctx.strokeStyle = "rgba(255,248,123,0.85)"; ctx.stroke();
  }
  ctx.restore();
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, W: number) {
  const r = Math.max(9, W * 0.014);
  ctx.save();
  ctx.lineWidth = Math.max(2.5, W * 0.004);
  ctx.strokeStyle = "rgba(76,55,24,0.9)";
  ctx.beginPath(); ctx.arc(x, y, r + ctx.lineWidth, 0, 2 * Math.PI); ctx.stroke();
  ctx.strokeStyle = "rgba(255,248,123,0.98)";
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 2, y); ctx.lineTo(x - r * 0.7, y);
  ctx.moveTo(x + r * 0.7, y); ctx.lineTo(x + r * 2, y);
  ctx.moveTo(x, y - r * 2); ctx.lineTo(x, y - r * 0.7);
  ctx.moveTo(x, y + r * 0.7); ctx.lineTo(x, y + r * 2);
  ctx.stroke();
  ctx.restore();
}

function renderCOG(href: string, canvas: HTMLCanvasElement, opts: RenderOpts): Promise<{ bw: number; bh: number }> {
  return GT().fromUrl(href).then((tiff: any) => {
    return tiff.getImageCount().then((count: number) => {
      const reqs = [];
      for (let i = 0; i < count; i++) reqs.push(tiff.getImage(i));
      return Promise.all(reqs).then((imgs: any[]) => {
        const W = imgs[0].getWidth(), H = imgs[0].getHeight();
        const levels = imgs.map((im) => ({ img: im, w: im.getWidth(), dec: W / im.getWidth() })).filter((l) => l.w > 0);

        let win: number[];
        if (opts.frame && opts.frame.length >= 3) {
          const oxs = opts.frame.map((p) => p.col);
          const oys = opts.frame.map((p) => p.row);
          const mnx = Math.min(...oxs), mxx = Math.max(...oxs);
          const mny = Math.min(...oys), mxy = Math.max(...oys);
          const pad = Math.max(mxx - mnx, mxy - mny) * 0.65 + 60;
          win = [mnx - pad, mny - pad, mxx + pad, mxy + pad];
        } else if (opts.center) {
          const half = Math.round((opts.spanPx || 1400) / 2), halfV = Math.round(half * 3 / 4);
          win = [opts.center.col - half, opts.center.row - halfV, opts.center.col + half, opts.center.row + halfV];
        } else {
          win = [0, 0, W, H];
        }
        win[0] = Math.max(0, Math.min(W - 2, win[0])); win[2] = Math.max(win[0] + 1, Math.min(W, win[2]));
        win[1] = Math.max(0, Math.min(H - 2, win[1])); win[3] = Math.max(win[1] + 1, Math.min(H, win[3]));
        const spanW = win[2] - win[0];

        const targetRead = Math.min(1600, Math.max(720, (opts.canvasW || 640) * 1.4));
        let lvl = levels[0];
        for (let li = 0; li < levels.length; li++) {
          if (spanW / levels[li].dec >= targetRead && levels[li].dec > lvl.dec) lvl = levels[li];
        }
        const dec = lvl.dec;
        const ow = [Math.floor(win[0] / dec), Math.floor(win[1] / dec), Math.ceil(win[2] / dec), Math.ceil(win[3] / dec)];
        const ycbcr = lvl.img.fileDirectory && lvl.img.fileDirectory.PhotometricInterpretation === 6;

        return lvl.img.readRasters({ interleave: true, samples: [0, 1, 2], window: ow }).then((raster: any) => {
          const bw = ow[2] - ow[0], bh = ow[3] - ow[1], n = bw * bh;
          const rgba = new Uint8ClampedArray(n * 4);
          for (let i = 0, j = 0, k = 0; i < n; i++, j += 4, k += 3) {
            if (ycbcr) { yiq(raster, k, rgba, j); }
            else { rgba[j] = raster[k]; rgba[j + 1] = raster[k + 1]; rgba[j + 2] = raster[k + 2]; }
            rgba[j + 3] = 255;
          }
          const offc = document.createElement("canvas");
          offc.width = bw; offc.height = bh;
          const offctx = offc.getContext("2d");
          if (!offctx) throw new Error("2d-context mangler");
          offctx.putImageData(new ImageData(rgba, bw, bh), 0, 0);

          const outW = opts.canvasW || 1024, outH = Math.round(outW * bh / bw);
          canvas.width = outW; canvas.height = outH;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("2d-context mangler");
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
          ctx.drawImage(offc, 0, 0, outW, outH);

          const toCanvas = (col: number, row: number): CanvasPt => ({ x: (col / dec - ow[0]) / bw * outW, y: (row / dec - ow[1]) / bh * outH });
          const proj = (poly: Pt[]) => poly.map((p) => toCanvas(p.col, p.row));
          const hasB = !!(opts.building && opts.building.length >= 3);
          const hasP = !!(opts.parcel && opts.parcel.length >= 3);
          if (hasP) drawShape(ctx, proj(opts.parcel as Pt[]), outW, !hasB);
          if (hasB) drawShape(ctx, proj(opts.building as Pt[]), outW, true);
          if (!hasB && !hasP && opts.center) {
            const m = toCanvas(opts.center.col, opts.center.row);
            if (m.x > 0 && m.x < outW && m.y > 0 && m.y < outH) drawMarker(ctx, m.x, m.y, outW);
          }
          return { bw, bh };
        });
      });
    });
  });
}

/* ================== ORKESTRERING ================== */
export type RenderResult = {
  ok: boolean;
  drew: "building" | "parcel" | "marker" | "frame" | null;
  year: string;
  direction: string;
  directionDa: string;
  collection: string;
  matrikelnr?: string;
};

export type RenderInput = {
  address: string;
  config: SkraafotoConfig;
  direction?: string;
  canvasW?: number;
  /** Kaldes ved hver async-grænse; returnér true for at annullere (nyere kald i gang). */
  shouldAbort?: () => boolean;
};

/** Tegner skråfotoet ind i canvas. Kaster "stale" ved abort og render-fejl som
    kalderen viser som fallback; datafejl håndteres af de enkelte trin. */
export async function renderSkraafoto(canvas: HTMLCanvasElement, input: RenderInput): Promise<RenderResult> {
  const { address, config: cfg } = input;
  const stale = () => (input.shouldAbort ? input.shouldAbort() : false);
  await loadGeoTIFF();

  const geo = await geocode(address, cfg);
  if (stale()) throw new Error("stale");
  const [item, parcel, building] = await Promise.all([
    findItem(geo.lon, geo.lat, input.direction, cfg),
    getParcel(geo.id, cfg),
    getBuilding(geo.id, cfg),
  ]);
  if (stale()) throw new Error("stale");
  if (!item.href) throw new Error("Item uden billed-URL");

  const zc: [number, number] = building ? building.center : (parcel ? parcel.centroid : [geo.X, geo.Y]);
  const Z = await terrainZ(zc[0], zc[1], cfg);
  if (stale()) throw new Error("stale");

  const inBounds = (px: [number, number]) => px[0] > 0 && px[0] < item.W && px[1] > 0 && px[1] < item.H;
  const projPoly = (ring: Ring): Pt[] => ring.map((c) => { const px = projectRaster(item, c[0], c[1], Z); return { col: px[0], row: px[1] }; });

  let buildingPx: Pt[] | null = null, parcelPx: Pt[] | null = null, center: Pt | null = null, frame: Pt[] | null = null;
  try {
    if (building) {
      const bc = projectRaster(item, building.center[0], building.center[1], Z);
      if (inBounds(bc)) { buildingPx = projPoly(building.ring); center = { col: bc[0], row: bc[1] }; frame = buildingPx; }
    }
    if (parcel) {
      parcelPx = projPoly(parcel.ring);
      if (!center) {
        const pc = projectRaster(item, parcel.centroid[0], parcel.centroid[1], Z);
        if (inBounds(pc)) center = { col: pc[0], row: pc[1] };
      }
      if (!frame) frame = parcelPx;
    }
    if (!frame && !center) {
      const apx = projectRaster(item, geo.X, geo.Y, Z);
      if (inBounds(apx)) center = { col: apx[0], row: apx[1] };
    }
  } catch { /* projektion fejlede → hele rammen */ }

  await renderCOG(item.href, canvas, {
    frame, building: buildingPx, parcel: parcelPx, center,
    spanPx: cfg.cropSpanPx || 1400, canvasW: input.canvasW || 1024,
  });
  if (stale()) throw new Error("stale");

  const year = (item.collection.match(YEAR_RE) || [])[1] || "";
  const drew: RenderResult["drew"] = buildingPx ? "building" : parcelPx ? "parcel" : center ? "marker" : "frame";
  return {
    ok: true, drew, year,
    direction: item.direction, directionDa: DIR_DA[item.direction] || item.direction,
    collection: item.collection,
    matrikelnr: parcel?.matrikelnr,
  };
}
