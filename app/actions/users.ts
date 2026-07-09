"use server";

// Brugeroprettelse. KUN administratorer må oprette nye brugere (admin- eller
// medarbejder-profiler). Adgangskoder hashes med scrypt (lib/auth) — samme
// format som login/seed. Node-only.
import { prisma, isUniqueViolation } from "@/lib/db";
import { getSessionUser } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type UserState = { error?: string; ok?: boolean };

export async function createUser(_prev: UserState, formData: FormData): Promise<UserState> {
  const me = await getSessionUser();
  if (!me) return { error: "Du er ikke logget ind." };
  if (!me.isAdmin) return { error: "Kun administratorer kan oprette brugere." };

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rolle = String(formData.get("rolle") ?? "medarbejder");

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "Brugernavn skal være 3–40 tegn: små bogstaver, tal, . _ -" };
  if (!firstName || !lastName) return { error: "Angiv både for- og efternavn." };
  if (password.length < 8) return { error: "Adgangskoden skal være mindst 8 tegn." };
  if (email && email.indexOf("@") < 1) return { error: "Tjek e-mailen — den ser ikke rigtig ud." };
  if (rolle !== "admin" && rolle !== "medarbejder") return { error: "Ugyldig rolle." };

  const company = await prisma.company.findFirst();
  if (!company) return { error: "Ingen virksomhed fundet." };

  try {
    await prisma.user.create({
      data: {
        companyId: company.id,
        username,
        firstName,
        lastName,
        email: email || null,
        passwordHash: hashPassword(password),
        isAdmin: rolle === "admin",
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Brugernavnet er allerede taget." };
    throw e;
  }
  revalidatePath("/users");
  return { ok: true };
}
