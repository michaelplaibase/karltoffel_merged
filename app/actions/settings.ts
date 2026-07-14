"use server";

// Server actions for the settings pages + message templates. They persist into
// the JSON store on Company.settings (see lib/settings-store).
import { setSettingsValues, setTemplateValues } from "@/lib/settings-store";
import { guardAction } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type SaveState = { saved?: boolean };
export type MinuteRateState = { saved?: boolean; error?: string };

export async function saveSettings(route: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await guardAction();
  const values: Record<string, string[]> = {};
  for (const key of new Set(formData.keys())) {
    // Only our positional field keys (sNfM) — skip React's $ACTION_* form fields.
    if (!/^s\d+f\d+$/.test(key)) continue;
    values[key] = formData.getAll(key).map(String);
  }
  await setSettingsValues(route, values);
  revalidatePath(route);
  return { saved: true };
}

/** Minutpris (kr/min EKSKL. moms) til varighedsberegning — gemmes i øre på
 *  Company.minutePriceOere (single-tenant: findFirst, som settings-store). */
export async function saveMinuteRate(_prev: MinuteRateState, formData: FormData): Promise<MinuteRateState> {
  await guardAction();
  const raw = String(formData.get("minuteRate") ?? "").trim().replace(",", ".");
  const rate = Number(raw);
  if (!raw || !Number.isFinite(rate) || rate <= 0) return { error: "Angiv en gyldig minutpris." };
  await prisma.company.update({
    where: { id: (await prisma.company.findFirst())!.id },
    data: { minutePriceOere: Math.round(rate * 100) },
  });
  revalidatePath("/settings");
  return { saved: true };
}

export async function saveTemplate(key: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await guardAction();
  await setTemplateValues(key, {
    subjects: formData.getAll("subject").map(String),
    body: String(formData.get("body") ?? ""),
    smsSender: String(formData.get("smsSender") ?? ""),
  });
  revalidatePath(`/templates/${key}`);
  return { saved: true };
}
