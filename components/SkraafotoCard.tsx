"use client";

/* Skråfoto-verifikation til CRM-backenden. Viser et rigtigt skråfoto af kundens
   ejendom (bygning + grund markeret) fra Dataforsyningen, så en medarbejder kan
   bekræfte at adressen rammer den rigtige ejendom — og krydstjekke de auto-målte
   tal (grund/have/tag/hæk) mod det kunden valgte. Genbruger den samme pipeline
   som sitets tilbudsmotor (lib/skraafoto.ts). Fejler pænt → SVG-illustration. */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeConfig, renderSkraafoto, measureProperty, VERIFY_DIRS, DIR_DA,
  type Measurement, type RenderResult,
} from "@/lib/skraafoto";

type Props = {
  address: string;
  token: string;
  showMeasurements?: boolean;
};

const DKK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const m2 = (v?: number) => (v != null ? DKK.format(v) + " m²" : "—");

export default function SkraafotoCard({ address, token, showMeasurements = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [dirIdx, setDirIdx] = useState(0);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [meta, setMeta] = useState<RenderResult | null>(null);
  const [maal, setMaal] = useState<Measurement | null>(null);

  const addr = address.trim();
  const hasAddr = addr.length >= 3;
  const configured = !!token;

  /* --- Tegn skråfotoet (kører ved adresse-/retnings-/retry-skift). All setState
         sker inde i den async-funktion (ikke synkront i effekt-kroppen), så vi
         ikke tripper react-hooks/set-state-in-effect. --- */
  useEffect(() => {
    if (!hasAddr || !configured) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true; // sættes false i cleanup → superseder in-flight ved re-run/unmount
    const cfg = makeConfig(token);
    const outW = Math.min(1024, Math.round((wrapRef.current?.clientWidth || 640) * (window.devicePixelRatio || 1)));

    (async () => {
      setStatus("loading");
      setMeta(null);
      try {
        const r = await renderSkraafoto(canvas, {
          address: addr, config: cfg, direction: VERIFY_DIRS[dirIdx], canvasW: outW,
          shouldAbort: () => !active,
        });
        if (active) { setMeta(r); setStatus("ok"); }
      } catch (err) {
        if (!active) return; // superseded → ignorér
        setStatus("error");
        if (typeof console !== "undefined") console.warn("[skraafoto]", err);
      }
    })();

    return () => { active = false; };
  }, [addr, dirIdx, retry, token, hasAddr, configured]);

  /* --- Auto-mål (retnings-uafhængigt; kun ved adresseskift) --- */
  useEffect(() => {
    if (!showMeasurements || !hasAddr || !configured) return;
    let active = true;
    (async () => {
      setMaal(null);
      const m = await measureProperty(addr, makeConfig(token));
      if (active) setMaal(m);
    })();
    return () => { active = false; };
  }, [addr, token, hasAddr, configured, showMeasurements]);

  const nextAngle = useCallback(() => setDirIdx((i) => (i + 1) % VERIFY_DIRS.length), []);

  const badgeText =
    status === "loading" ? "Henter skråfoto …"
      : status === "ok" && meta ? `Skråfoto ${meta.year} · set mod ${meta.directionDa}`
        : "Luftfoto (illustration)";

  const noteText =
    status === "ok" && meta
      ? (meta.drew === "building"
          ? `Rigtigt skråfoto fra Dataforsyningen (${meta.collection}). Bygningen er markeret, grunden${meta.matrikelnr ? ` (matr. ${meta.matrikelnr})` : ""} stiplet.`
          : meta.drew === "parcel"
            ? `Rigtigt skråfoto fra Dataforsyningen (${meta.collection}). Grunden${meta.matrikelnr ? ` (matr. ${meta.matrikelnr})` : ""} er markeret.`
            : `Rigtigt skråfoto fra Dataforsyningen (${meta.collection}).`)
      : status === "error"
        ? "Vi kunne ikke hente luftfotoet for denne adresse lige nu."
        : "";

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h4 className="section-title">Skråfoto — verificér ejendom</h4>
        {status === "ok" && meta ? (
          <button type="button" className="btn btn-light btn-sm" onClick={nextAngle}>
            <i className="bi bi-arrow-repeat" /> Skift vinkel ({DIR_DA[VERIFY_DIRS[(dirIdx + 1) % VERIFY_DIRS.length]]})
          </button>
        ) : null}
      </div>
      <div className="card-body tight">
        {!configured ? (
          <p className="muted" style={{ margin: 0 }}>
            Skråfoto er ikke konfigureret. Sæt <code>DATAFORSYNINGEN_TOKEN</code> i miljøet for at aktivere verifikationen.
          </p>
        ) : !hasAddr ? (
          <p className="muted" style={{ margin: 0 }}>Ingen adresse på kunden at slå op.</p>
        ) : (
          <>
            <div ref={wrapRef} className="sf-foto" aria-busy={status === "loading"}>
              <span className="sf-badge">{badgeText}</span>
              <canvas
                ref={canvasRef}
                className="sf-canvas"
                role="img"
                aria-label={`Skråfoto af ${addr}`}
                style={{ display: status === "ok" ? "block" : "none" }}
              />
              {status !== "ok" ? (
                <svg className="sf-fallback" viewBox="0 0 640 380" role="img" aria-label="Luftfoto-illustration">
                  <rect width="640" height="380" fill="#e9e4c6" />
                  <path d="M0 300 Q160 260 320 300 T640 290 V380 H0 Z" fill="#d8d2ad" />
                  <rect x="70" y="60" width="500" height="270" fill="none" stroke="#86612A" strokeWidth="3" strokeDasharray="10 8" />
                  <rect x="120" y="120" width="180" height="120" fill="#4C3718" />
                  <polygon points="120,120 210,80 300,120" fill="#5a4322" />
                  <rect x="150" y="150" width="30" height="30" fill="#FFF87B" />
                  <rect x="230" y="150" width="30" height="30" fill="#FFF87B" />
                  <circle cx="480" cy="140" r="34" fill="#9aa06b" />
                  <circle cx="520" cy="200" r="24" fill="#9aa06b" />
                  {status === "loading" ? <text x="320" y="200" textAnchor="middle" fontSize="18" fill="#4C3718">Henter skråfoto …</text> : null}
                </svg>
              ) : null}
            </div>
            {noteText ? <small className="muted" style={{ display: "block", marginTop: 8 }}>{noteText}</small> : null}
            {status === "error" ? (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-light btn-sm" onClick={() => setRetry((x) => x + 1)}>
                  <i className="bi bi-arrow-clockwise" /> Prøv igen
                </button>
              </div>
            ) : null}

            {showMeasurements && maal ? (
              <div className="sf-maal">
                <div className="sf-maal-head">Auto-målt fra matrikel + DHM (skråfoto/højdemodel) — ca.-tal til krydstjek</div>
                <div className="sf-maal-grid">
                  <Fact label="Grundareal" value={m2(maal.grundAreal)} />
                  <Fact label="Haveareal" value={m2(maal.haveAreal)} />
                  <Fact label="Bygningsareal" value={m2(maal.bygningsAreal)} />
                  <Fact label="Tagareal" value={m2(maal.tagArealSkraat ?? maal.tagAreal)} />
                  {maal.taghaeldning != null ? <Fact label="Taghældning" value={`${maal.taghaeldning}°`} /> : null}
                  {maal.rygHojde != null ? <Fact label="Ryghøjde" value={`${String(maal.rygHojde).replace(".", ",")} m`} /> : null}
                  <Fact label="Hæk-omkreds" value={`${DKK.format(maal.haekLangde)} m`} />
                  {maal.haekHojde != null ? <Fact label="Hækhøjde ca." value={`${String(maal.haekHojde).replace(".", ",")} m`} /> : null}
                  <Fact label="Antal bygninger" value={String(maal.antalBygninger)} />
                  {maal.tagrendeLangde != null ? <Fact label="Tagrende ca." value={`${DKK.format(maal.tagrendeLangde)} m`} /> : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="sf-fact">
      <b>{label}</b>
      <span>{value}</span>
    </div>
  );
}
