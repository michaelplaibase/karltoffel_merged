"use server";

// Server actions for the settings catalogs backed by real models: discount codes
// (Rabatkoder) and standard tasks (Standardopgaver).
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type CatalogState = { error?: string; ok?: boolean };

// ---- Discount codes --------------------------------------------------------

export async function createDiscountCode(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  const code = String(formData.get("code") ?? "").trim();
  const percent = Number(formData.get("percent"));
  const expires = String(formData.get("expiresAt") ?? "").trim();
  if (!code) return { error: "Angiv en rabatkode." };
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return { error: "Angiv en procentsats mellem 1 og 100." };
  await prisma.discountCode.create({
    data: { code, percent, expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? new Date(`${expires}T00:00:00Z`) : null },
  });
  revalidatePath("/discount-codes");
  return { ok: true };
}

export async function deleteDiscountCode(id: number): Promise<void> {
  await prisma.discountCode.delete({ where: { id } });
  revalidatePath("/discount-codes");
}

// ---- Standard tasks --------------------------------------------------------

export async function createStandardTask(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const presence = formData.get("presence") === "on";
  if (!category) return { error: "Vælg en kategori." };
  if (!description) return { error: "Angiv en beskrivelse." };
  const company = await prisma.company.findFirst();
  if (!company) return { error: "Ingen virksomhed fundet." };
  await prisma.standardTask.create({
    data: { companyId: company.id, category, description, letter: category[0]?.toUpperCase() ?? "A", customerPresenceRequired: presence },
  });
  revalidatePath("/standard-tasks");
  return { ok: true };
}

/** Deactivate/reactivate a standard task (system tasks are locked). */
export async function toggleStandardTask(id: number): Promise<void> {
  const t = await prisma.standardTask.findUnique({ where: { id } });
  if (!t || t.isSystem) return;
  await prisma.standardTask.update({ where: { id }, data: { active: !t.active } });
  revalidatePath("/standard-tasks");
}
