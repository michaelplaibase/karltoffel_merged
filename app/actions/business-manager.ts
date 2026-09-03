"use server";

// Business Manager skrivninger (kun admin): biler, maskiner og budget.
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const me = await getSessionUser();
  return me?.isAdmin ? me : null;
}

const int = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

// ---------- Biler ----------
export async function saveVehicle(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const assignedRaw = String(formData.get("userId") ?? "").trim();
  const data = {
    name: str(formData.get("name")) || "Uden navn",
    active: formData.get("active") !== null,
    leaseMonthly: int(formData.get("leaseMonthly")),
    insuranceMonthly: int(formData.get("insuranceMonthly")),
    fuelMonthly: int(formData.get("fuelMonthly")),
    serviceMonthly: int(formData.get("serviceMonthly")),
    otherMonthly: int(formData.get("otherMonthly")),
    note: str(formData.get("note")) || null,
    userId: assignedRaw !== "" ? Number(assignedRaw) : null,
  };
  const id = int(formData.get("id"));
  if (id > 0) await prisma.vehicle.update({ where: { id }, data });
  else await prisma.vehicle.create({ data: { ...data, companyId: 1 } });
  revalidatePath("/business-manager/biler");
  revalidatePath("/business-manager");
  revalidatePath("/business-manager/medarbejdere");
}

export async function deleteVehicle(id: number): Promise<void> {
  if (!(await requireAdmin())) return;
  await prisma.vehicle.delete({ where: { id } });
  revalidatePath("/business-manager/koeretoejer");
  revalidatePath("/business-manager");
}

// ---------- Maskiner ----------
export async function saveMachine(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const data = {
    name: str(formData.get("name")) || "Uden navn",
    active: formData.get("active") !== null,
    purchasePrice: int(formData.get("purchasePrice")),
    lifetimeYears: int(formData.get("lifetimeYears")),
    serviceMonthly: int(formData.get("serviceMonthly")),
    otherMonthly: int(formData.get("otherMonthly")),
    note: str(formData.get("note")) || null,
  };
  const id = int(formData.get("id"));
  if (id > 0) await prisma.machine.update({ where: { id }, data });
  else await prisma.machine.create({ data: { ...data, companyId: 1 } });
  revalidatePath("/business-manager/maskiner");
  revalidatePath("/business-manager");
}

export async function deleteMachine(id: number): Promise<void> {
  if (!(await requireAdmin())) return;
  await prisma.machine.delete({ where: { id } });
  revalidatePath("/business-manager/maskiner");
  revalidatePath("/business-manager");
}

// ---------- Budget (pr. måned) ----------
export async function saveBudget(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const year = int(formData.get("year"));
  const month = int(formData.get("month"));
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return;
  const data = {
    revenueBudget: int(formData.get("revenueBudget")),
    costBudget: int(formData.get("costBudget")),
    note: str(formData.get("note")) || null,
  };
  await prisma.budget.upsert({
    where: { companyId_year_month: { companyId: 1, year, month } },
    create: { companyId: 1, year, month, ...data },
    update: data,
  });
  revalidatePath("/business-manager/oekonomi");
  revalidatePath("/business-manager");
}
