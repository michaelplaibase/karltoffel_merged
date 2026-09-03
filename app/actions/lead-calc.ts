"use server";

// Lead-beregner skrivninger (kun admin): registrér erhvervelse + marketingforbrug.
// Nye kunder med abonnement/fastpris registreres AUTOmatisk ved oprettelse
// (se hooks i app/actions) — knappen her er til kunder uden abo/fastpris endnu.
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const int = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

async function requireAdmin() {
  const me = await getSessionUser();
  return me?.isAdmin ? me : null;
}

/** Registrér (eller opdatér) en kundeerhvervelse. Auto-kaldes også fra andre actions. */
export async function registerAcquisition(contactId: number, category: string, source: string, startedAt?: Date, note?: string): Promise<void> {
  if (!(await requireAdmin())) return;
  if (!["privat", "virksomhed", "fastpris"].includes(category)) return;
  await prisma.leadAcquisition.upsert({
    where: { contactId_category: { contactId, category } },
    create: { companyId: 1, contactId, category, source: source || "Direkte", startedAt: startedAt ?? new Date(), note: note ?? null },
    update: { source: source || "Direkte", ...(startedAt ? { startedAt } : {}) },
  });
  revalidatePath("/business-manager/leads");
  revalidatePath("/business-manager");
}

export async function registerAcquisitionForm(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const contactId = int(formData.get("contactId"));
  if (contactId <= 0) return;
  await registerAcquisition(
    contactId,
    str(formData.get("category")),
    str(formData.get("source")) || "Direkte",
    str(formData.get("startedAt")) ? new Date(`${str(formData.get("startedAt"))}T12:00:00Z`) : undefined,
    str(formData.get("note")) || undefined,
  );
}

export async function saveMarketingSpend(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const channel = str(formData.get("channel"));
  const year = int(formData.get("year"));
  const month = int(formData.get("month"));
  if (!channel || year < 2000 || year > 2100 || month < 1 || month > 12) return;
  const amount = int(formData.get("amount"));
  await prisma.marketingSpend.upsert({
    where: { companyId_channel_year_month: { companyId: 1, channel, year, month } },
    create: { companyId: 1, channel, year, month, amount },
    update: { amount },
  });
  revalidatePath("/business-manager/leads");
  revalidatePath("/business-manager");
}

export async function deleteAcquisition(id: number): Promise<void> {
  if (!(await requireAdmin())) return;
  await prisma.leadAcquisition.delete({ where: { id } });
  revalidatePath("/business-manager/leads");
}

/** AUTO-registrering: kaldes fra kunde/abonnement/fastpris-oprettelse (best effort). */
export async function autoRegisterAcquisition(contactId: number, category: "privat" | "virksomhed" | "fastpris", source = "Direkte"): Promise<void> {
  try {
    await prisma.leadAcquisition.upsert({
      where: { contactId_category: { contactId, category } },
      create: { companyId: 1, contactId, category, source },
      update: {},
    });
    revalidatePath("/business-manager/leads");
  } catch {
    // best effort — erhvervelses-registrering må aldrig blokere kundeoprettelse
  }
}
