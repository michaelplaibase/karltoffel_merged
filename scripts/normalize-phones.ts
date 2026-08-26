// Engangs-oprydning: normaliser Contact.phone til rene cifre uden +45-præfiks
// ("12 34 56 78" og "+45 12345678" → "12345678"), så telefonsøgning matcher
// på tværs af lead-konverterede (allerede normaliserede) og håndindtastede
// kunder. Kør: npx tsx scripts/normalize-phones.ts [--dry]
import { prisma } from "../lib/db";

// Normalisér KUN danske numre (8 cifre, evt. 45/0045-præfiks) — udenlandske
// og maskerede numre bevares som de står, så de forbliver opringbare.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return /^(?:45|0045)?\d{8}$/.test(digits) ? digits.slice(-8) : raw.trim();
}

async function main() {
  const dry = process.argv.includes("--dry");
  const rows = await prisma.contact.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
  let changed = 0;
  for (const row of rows) {
    const normalized = normalizePhone(row.phone!);
    if (!normalized || normalized === row.phone) continue;
    changed++;
    if (dry) console.log(`#${row.id}: '${row.phone}' -> '${normalized}'`);
    else await prisma.contact.update({ where: { id: row.id }, data: { phone: normalized } });
  }
  console.log(`${dry ? "Ville normalisere" : "Normaliserede"} ${changed} af ${rows.length} telefonnumre.`);
}

if (process.argv[1]?.endsWith("normalize-phones.ts")) main().finally(() => prisma.$disconnect());
