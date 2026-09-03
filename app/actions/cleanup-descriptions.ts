"use server";

// Oprydning af opgavebeskrivelser (Michael, 2026-09-02): "Der må ikke stå
// WorkMaker nogen steder!" — WorkMaker-metadata ("WorkMaker pris inkl. moms:
// 326.4 WorkMaker subscription: 656b4d9a-…") blev skrevet direkte ind i
// TaskLine.description i produktionsdatabasen under systemovergangen. Strengen
// findes IKKE i koden, så oprydningen er et data-fix der kører mod databasen,
// plus en normalisering af alle fremtidige gem/met beskrivelser.
import { prisma } from "@/lib/db";
import { guardAction, getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";

/** Fjern alle "WorkMaker <nøgle>: <værdi>"-segmenter fra en beskrivelse.
 *  Segmentet starter ved "WorkMaker " og slutter ved næste "WorkMaker " eller
 *  strengens slutning — gentagne segmenter fjernes i én tur. Beskrivelsen
 *  før det første WorkMaker-segment bevares (trimmet); findes der INGEN tekst
 *  foran, returneres null så rækken kan rapporteres til manuel gennemgang. */
function stripWorkmaker(description: string): string | null {
  const idx = description.indexOf("WorkMaker");
  if (idx === -1) return description;
  const cleaned = description.slice(0, idx).trim().replace(/[,\-–:;]\s*$/, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export type CleanupResult = {
  ok: boolean;
  error?: string;
  scanned: number;
  cleaned: number;
  skipped: number; // beskrivelser der KUN bestod af WorkMaker-tekst — kræver manuel gennemgang
  samples: string[];
};

export async function cleanupWorkmakerDescriptions(): Promise<CleanupResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return { ok: false, error: "Kun administratorer kan rydde i opgavebeskrivelser.", scanned: 0, cleaned: 0, skipped: 0, samples: [] };
  }
  await guardAction();

  // Simpelt substring-scan: alle rækker hvis description nævner WorkMaker.
  // (contains matcher også præfikset "WorkMaker …" når det står først.)
  const rows = await prisma.taskLine.findMany({
    where: { description: { contains: "WorkMaker" } },
    select: { id: true, description: true },
  });

  let cleaned = 0;
  let skipped = 0;
  const samples: string[] = [];

  for (const row of rows) {
    const stripped = stripWorkmaker(row.description);
    if (stripped === null) {
      // Kun WorkMaker-tekst — ingen rigtig beskrivelse at bevare.
      skipped++;
      if (samples.length < 8) samples.push(`#${row.id}: "${row.description.slice(0, 90)}"`);
      continue;
    }
    await prisma.taskLine.update({ where: { id: row.id }, data: { description: stripped } });
    cleaned++;
    if (samples.length < 8) samples.push(`#${row.id}: "${row.description.slice(0, 60)}" → "${stripped.slice(0, 60)}"`);
  }

  revalidatePath("/fakturering");
  revalidatePath("/orders");
  revalidatePath("/subscriptions");
  revalidatePath("/daycalendar");
  return { ok: true, scanned: rows.length, cleaned, skipped, samples };
}
