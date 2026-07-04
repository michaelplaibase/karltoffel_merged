"use server";

import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { signSession, verifySession, SESSION_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = { error?: string };
export type ChangePasswordState = { error?: string; ok?: boolean };

export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const userId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return { error: "Din session er udløbet. Log ind igen." };
  const oldPw = String(formData.get("old") ?? "");
  const newPw = String(formData.get("new") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!oldPw || !newPw) return { error: "Udfyld alle felter." };
  if (newPw.length < 6) return { error: "Den nye adgangskode skal være mindst 6 tegn." };
  if (newPw !== confirm) return { error: "De to nye adgangskoder er ikke ens." };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash || !verifyPassword(oldPw, user.passwordHash)) return { error: "Den nuværende adgangskode er forkert." };
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(newPw) } });
  return { ok: true };
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Udfyld brugernavn og adgangskode." };

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: "Forkert brugernavn eller adgangskode." };
  }

  const token = await signSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/calendar");
}
