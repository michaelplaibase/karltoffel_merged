"use server";

// Tidsregistrering: "Check ind / Check ud" (til/fra arbejde).
// Node-only server actions. Hver handling guarder sig selv, da middleware
// undtager server-action-POSTs. Højst én åben registrering per bruger håndhæves
// i en transaktion (portabelt uden partial unique index).
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Åbn en registrering, hvis brugeren ikke allerede er checket ind.
export async function checkIn(): Promise<void> {
  const userId = await requireSession();
  if (userId == null) redirect("/login");
  await prisma.$transaction(async (tx) => {
    const open = await tx.timeEntry.findFirst({ where: { userId, checkOut: null } });
    if (!open) await tx.timeEntry.create({ data: { userId } });
  });
  revalidatePath("/daycalendar");
  revalidatePath("/timesheet");
}

// Luk den seneste åbne registrering, hvis der er en.
export async function checkOut(): Promise<void> {
  const userId = await requireSession();
  if (userId == null) redirect("/login");
  await prisma.$transaction(async (tx) => {
    const open = await tx.timeEntry.findFirst({
      where: { userId, checkOut: null },
      orderBy: { checkIn: "desc" },
    });
    if (open) await tx.timeEntry.update({ where: { id: open.id }, data: { checkOut: new Date() } });
  });
  revalidatePath("/daycalendar");
  revalidatePath("/timesheet");
}
