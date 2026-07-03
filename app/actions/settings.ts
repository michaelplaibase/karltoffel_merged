"use server";

// Server actions for the settings pages + message templates. They persist into
// the JSON store on Company.settings (see lib/settings-store).
import { setSettingsValues, setTemplateValues } from "@/lib/settings-store";
import { revalidatePath } from "next/cache";

export type SaveState = { saved?: boolean };

export async function saveSettings(route: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
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

export async function saveTemplate(key: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await setTemplateValues(key, {
    subjects: formData.getAll("subject").map(String),
    body: String(formData.get("body") ?? ""),
    smsSender: String(formData.get("smsSender") ?? ""),
  });
  revalidatePath(`/templates/${key}`);
  return { saved: true };
}
