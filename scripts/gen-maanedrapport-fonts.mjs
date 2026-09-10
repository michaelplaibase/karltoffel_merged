// Regenerér lib/maanedrapport-fonts.ts efter font-opdatering:
//   node scripts/gen-maanedrapport-fonts.mjs
import fs from "node:fs";

const enc = (f) => "data:font/ttf;base64," + fs.readFileSync(f).toString("base64");

const out =
  `// Auto-genereret: fonts som base64 data-URIs, så @react-pdf/renderer kan\n` +
  `// registrere dem uden fs-adgang (Vercel-serverless-sikkert).\n` +
  `// Kilder: assets/fonts/* — regenerér med: node scripts/gen-maanedrapport-fonts.mjs\n` +
  `export const SNAGA_BLACK = ${JSON.stringify(enc("assets/fonts/SnagaUniText-Black.ttf"))};\n` +
  `export const HANKEN_REGULAR = ${JSON.stringify(enc("assets/fonts/HankenGrotesk-Regular.ttf"))};\n` +
  `export const HANKEN_SEMIBOLD = ${JSON.stringify(enc("assets/fonts/HankenGrotesk-SemiBold.ttf"))};\n`;

fs.writeFileSync("lib/maanedrapport-fonts.ts", out);
console.log("lib/maanedrapport-fonts.ts regenereret");
