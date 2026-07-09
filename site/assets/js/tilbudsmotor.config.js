/* ==========================================================================
   Karltoffel Tilbudsmotor — konfiguration.
   --------------------------------------------------------------------------
   ⚠️  SIKKERHED: Denne fil indeholder et Dataforsyningen-token i klartekst.
       Det er OK til lokal demo. FØR upload til et offentligt domæne:
         1) Lås tokenet til jeres domæne(r) på dataforsyningen.dk
            (Administrer token → referer/domæne-binding), ELLER
         2) flyt kaldene bag en lille proxy, så tokenet aldrig sendes til
            browseren, og ryd denne fil.
       Samme token bruges til både STAC-API'et og COG-billederne på CDN'et.
   ========================================================================== */
window.KARLTOFFEL = window.KARLTOFFEL || {};
window.KARLTOFFEL.skraafoto = {
  /* Dataforsyningen webservice-token (dataforsyningen.dk → Administrer token). */
  token: "e97ac5544d9b810f9774c5ee5d1aa6a5",

  /* API-endpoints (verificeret live 03.07.2026). */
  stacBase: "https://api.dataforsyningen.dk/rest/skraafoto_api/v2",
  dawaBase: "https://api.dataforsyningen.dk",
  dhmWcsBase: "https://api.dataforsyningen.dk/dhm_wcs_DAF", /* terrænhøjde (Level B) */

  /* Level B: udsnittets bredde i fuld-opløsnings-pixels (0,1 m/px → 1400 ≈ 140 m). */
  cropSpanPx: 1400,

  /* Skråfoto-samlinger, nyeste først — første med dækning over adressen vinder. */
  collections: ["skraafotos2025", "skraafotos2023", "skraafotos2021"],

  /* Foretrukken optageretning (north/east/south/west). Falder tilbage til en
     vilkårlig skrå retning hvis den foretrukne ikke findes; nadir undgås. */
  direction: "north"
};
