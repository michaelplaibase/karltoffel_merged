"use server";

import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { signSession, verifySession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";
import { getSessionUser } from "@/lib/api-auth";
import { underLimit, recordHit } from "@/lib/rate-limit";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// values ekkoes ved fejl, så React 19's automatiske form-reset ikke smider
// brugernavn/'Husk mig' væk (adgangskoden ekkoes bevidst ALDRIG).
export type LoginState = { error?: string; values?: { username: string; remember: boolean } };
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
  const values = { username, remember: formData.get("remember") != null };
  if (!username || !password) return { error: "Udfyld brugernavn og adgangskode.", values };

  // Rate-limit by username+IP; only FAILED attempts count, so a valid login is
  // never penalised and one user can't be locked out by another's junk requests.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rlKey = `login:${username}:${ip}`;
  if (!underLimit(rlKey, 5)) return { error: "For mange forsøg. Prøv igen om lidt.", values };

  const user = await prisma.user.findUnique({ where: { username } });
  // Deaktiverede brugere (soft-delete) afvises på linje med forkert kodeord.
  if (!user || !user.active || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    recordHit(rlKey, 60_000);
    return { error: "Forkert brugernavn eller adgangskode.", values };
  }

  // "Husk mig" (default til): 30 dages login, ellers 7 dage. Cookie-maxAge og
  // token-exp holdes ens, så cookien ikke overlever tokenet (eller omvendt).
  const ttl = formData.get("remember") != null ? 60 * 60 * 24 * 30 : SESSION_TTL_SECONDS;
  const token = await signSession(user.id, ttl);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: ttl,
    secure: process.env.NODE_ENV === "production",
  });
  // Send brugeren videre til den side, middleware afbrød (?next=). Kun interne
  // stier accepteres: "/" men aldrig "//host", backslash ELLER kontroltegn/
  // whitespace — browsere striber tab/CR/LF ud af URL'er, så "/\t/evil.com"
  // ville ellers blive læst som den eksterne "//evil.com".
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !/[\x00-\x20\\]/.test(next);
  redirect(safeNext ? next : "/calendar");
}

/** Brugerens rolle til navigationen (Navbar er en client-komponent og kan ikke
 *  selv slå sessionen op). Kun til at SKJULE admin-menupunkter — selve
 *  adgangen håndhæves fortsat server-side på siderne og i deres actions. */
export async function getSessionIsAdmin(): Promise<boolean> {
  const me = await getSessionUser();
  return me?.isAdmin === true;
}

// Log ud via POST (server-action). BEVIDST ikke et GET-link: Next.js prefetcher
// links i viewport i produktion, og et prefetch af et GET-/logout ville slette
// sessionen uden et klik (den oprindelige "man bliver logget ud"-bug). En POST
// prefetches aldrig.
export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
