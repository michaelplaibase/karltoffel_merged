"use server";

// Brugeroprettelse, -redigering og deaktivering (soft-delete) + lønmodel. KUN
// administratorer. Adgangskoder hashes med scrypt (lib/auth). Node-only.
// Brugere SLETTES aldrig hårdt: TimeEntry.userId er RESTRICT og ordrehistorik
// skal bevares — deaktivering (active=false) låser i stedet login og skjuler
// brugeren i lister/vælgere.
import { prisma, isUniqueViolation } from "@/lib/db";
import { getSessionUser } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import { getSettingsValues, setSettingsValues } from "@/lib/settings-store";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// values ekkoes ved fejl: React 19 auto-resetter ukontrollerede formularfelter
// efter en form-action, så formularen prefiller med de indsendte værdier igen
// (adgangskoden ekkoes bevidst aldrig). Checkbokse ekkoes som "on"/"".
export type UserState = { error?: string; ok?: boolean; values?: Record<string, string> };

// Fast løn = manuelt beløb (kr/md). Akkord = provisionssats i % (default 43,
// beregnes af omsætning ekskl. moms — se lib/payroll.ts).
function payFields(payModel: string, belob: number | null) {
  const model = payModel === "akkord" ? "akkord" : "fast";
  const b = belob != null && Number.isFinite(belob) && belob >= 0 ? Math.round(belob) : null;
  return {
    payModel: model,
    commissionPct: model === "akkord" ? (b ?? 43) : null,
    monthlySalary: model === "fast" ? b : null,
  };
}

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
  const payModel = String(formData.get("payModel") ?? "fast");
  const belobRaw = String(formData.get("belob") ?? "").trim();
  const belob = belobRaw === "" ? null : Number(belobRaw);
  const values = { username, firstName, lastName, email, rolle, payModel, belob: belobRaw };

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "Brugernavn skal være 3–40 tegn: små bogstaver, tal, . _ -", values };
  if (!firstName || !lastName) return { error: "Angiv både for- og efternavn.", values };
  if (password.length < 8) return { error: "Adgangskoden skal være mindst 8 tegn.", values };
  if (email && email.indexOf("@") < 1) return { error: "Tjek e-mailen — den ser ikke rigtig ud.", values };
  if (rolle !== "admin" && rolle !== "medarbejder") return { error: "Ugyldig rolle.", values };
  if (belob != null && (!Number.isFinite(belob) || belob < 0)) return { error: "Beløb/sats skal være et positivt tal.", values };
  if (payModel === "akkord" && belob != null && belob > 100) return { error: "Provisionssatsen skal være mellem 0 og 100 %.", values };

  const company = await prisma.company.findFirst();
  if (!company) return { error: "Ingen virksomhed fundet.", values };

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
        ...payFields(payModel, belob),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Brugernavnet er allerede taget.", values };
    throw e;
  }
  revalidatePath("/users");
  revalidatePath("/payroll");
  return { ok: true };
}

// Sæt/ret en eksisterende brugers lønmodel (admin). Kaldes fra brugerlisten.
export async function updateUserPay(userId: number, payModel: string, belob: number | null): Promise<void> {
  const me = await getSessionUser();
  if (!me?.isAdmin) return;
  // Nægt stille (som de øvrige værn her): en provisionssats over 100 % er
  // altid en fejltastning — PayEditor afviser den også client-side.
  if (payModel === "akkord" && belob != null && belob > 100) return;
  await prisma.user.update({ where: { id: userId }, data: payFields(payModel, belob) });
  revalidatePath("/users");
  revalidatePath("/payroll");
}

function revalidateUsers() {
  revalidatePath("/users");
  revalidatePath("/payroll");
  revalidatePath("/calendar");
}

/** True hvis brugeren er den SIDSTE aktive administrator — så må admin-rollen
 *  eller adgangen ikke fjernes, ellers kan ingen længere administrere. */
async function isLastActiveAdmin(userId: number): Promise<boolean> {
  return (await prisma.user.count({ where: { isAdmin: true, active: true, id: { not: userId } } })) === 0;
}

// Rediger en eksisterende bruger (admin). Tom adgangskode = uændret.
export async function updateUser(userId: number, _prev: UserState, formData: FormData): Promise<UserState> {
  const me = await getSessionUser();
  if (!me) return { error: "Du er ikke logget ind." };
  if (!me.isAdmin) return { error: "Kun administratorer kan redigere brugere." };

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rolle = String(formData.get("rolle") ?? "medarbejder");
  const calendarColor = String(formData.get("calendarColor") ?? "").trim();
  const homeAddress = String(formData.get("homeAddress") ?? "").trim();
  const payModel = String(formData.get("payModel") ?? "fast");
  const belobRaw = String(formData.get("belob") ?? "").trim();
  const belob = belobRaw === "" ? null : Number(belobRaw);
  const checkbox = (name: string) => (formData.get(name) === "on" ? "on" : "");
  const values: Record<string, string> = {
    username, firstName, lastName, email, rolle, calendarColor, homeAddress, payModel, belob: belobRaw,
    activeCalendar: checkbox("activeCalendar"),
    canReceiveOnline: checkbox("canReceiveOnline"),
    canSeePrices: checkbox("canSeePrices"),
    canEditOrders: checkbox("canEditOrders"),
    canHandlePayment: checkbox("canHandlePayment"),
    canChangePaymentOption: checkbox("canChangePaymentOption"),
  };

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "Brugernavn skal være 3–40 tegn: små bogstaver, tal, . _ -", values };
  if (!firstName || !lastName) return { error: "Angiv både for- og efternavn.", values };
  if (password && password.length < 8) return { error: "Adgangskoden skal være mindst 8 tegn.", values };
  if (email && email.indexOf("@") < 1) return { error: "Tjek e-mailen — den ser ikke rigtig ud.", values };
  if (rolle !== "admin" && rolle !== "medarbejder") return { error: "Ugyldig rolle.", values };
  if (belob != null && (!Number.isFinite(belob) || belob < 0)) return { error: "Beløb/sats skal være et positivt tal.", values };
  if (payModel === "akkord" && belob != null && belob > 100) return { error: "Provisionssatsen skal være mellem 0 og 100 %.", values };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Brugeren blev ikke fundet.", values };

  // Værn: fjern aldrig din egen admin-rolle, og aldrig den sidste aktive admins.
  if (target.isAdmin && rolle !== "admin") {
    if (userId === me.id) return { error: "Du kan ikke fjerne din egen admin/adgang.", values };
    if (await isLastActiveAdmin(userId)) return { error: "Der skal altid være mindst én aktiv administrator.", values };
  }

  const oldFullName = `${target.firstName} ${target.lastName}`;
  const newFullName = `${firstName} ${lastName}`;

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          username,
          firstName,
          lastName,
          email: email || null,
          calendarColor: calendarColor || null,
          homeAddress: homeAddress || null,
          // En deaktiveret bruger må ALDRIG få aktiv kalender — kalenderen og
          // planlæggeren filtrerer kun på activeCalendar, så flaget ville ellers
          // give en deaktiveret bruger en kolonne og planlagte ordrer.
          activeCalendar: target.active ? formData.get("activeCalendar") === "on" : false,
          canReceiveOnline: formData.get("canReceiveOnline") === "on",
          canSeePrices: formData.get("canSeePrices") === "on",
          canEditOrders: formData.get("canEditOrders") === "on",
          canHandlePayment: formData.get("canHandlePayment") === "on",
          canChangePaymentOption: formData.get("canChangePaymentOption") === "on",
          isAdmin: rolle === "admin",
          ...payFields(payModel, belob),
          ...(password ? { passwordHash: hashPassword(password) } : {}),
        },
      }),
      // Abonnementers "Fast medarbejder" matcher på fulde navn (lib/recurrence.ts
      // defaultEmployeeId) — følg med ved navneskift, så fremtidige ordrer ikke
      // stille omfordeles til en anden.
      ...(newFullName !== oldFullName
        ? [prisma.subscription.updateMany({ where: { fixedEmployee: oldFullName }, data: { fixedEmployee: newFullName } })]
        : []),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Brugernavnet er allerede taget.", values };
    throw e;
  }
  revalidateUsers();
  redirect("/users");
}

// Ved deaktivering huskes brugerens activeCalendar-flag her (i settings-JSON'en
// på Company — ingen schema-ændring), så "Genaktivér" kan genoprette det, som
// det var. Nøglen er bruger-id som streng, værdien ["1"]/["0"].
const CALENDAR_STASH_KEY = "internal:deactivated-active-calendar";

/** Deaktivér en bruger (soft-delete — ALDRIG hård sletning: historik/tidsposter
 *  skal bevares). Låser login og fjerner brugeren fra kalender og vælgere.
 *  Nægter stille for dig selv og for den sidste aktive administrator (UI'et
 *  skjuler også valget dér). */
export async function deactivateUser(userId: number): Promise<void> {
  const me = await getSessionUser();
  if (!me?.isAdmin) return;
  if (userId === me.id) return;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, active: true, activeCalendar: true } });
  if (!target || !target.active) return;
  if (target.isAdmin && (await isLastActiveAdmin(userId))) return;
  // Husk kalender-flaget FØR det nulstilles, så genaktivering kan genoprette det.
  const stash = await getSettingsValues(CALENDAR_STASH_KEY);
  stash[String(userId)] = [target.activeCalendar ? "1" : "0"];
  await setSettingsValues(CALENDAR_STASH_KEY, stash);
  await prisma.user.update({ where: { id: userId }, data: { active: false, activeCalendar: false } });
  revalidateUsers();
}

/** Genaktivér en deaktiveret bruger. activeCalendar genoprettes, som det var
 *  før deaktiveringen — brugere deaktiveret før dette blev husket (eksisterende
 *  data) får kalenderen slået til, da deaktiveringen selv slog den fra. */
export async function reactivateUser(userId: number): Promise<void> {
  const me = await getSessionUser();
  if (!me?.isAdmin) return;
  const stash = await getSettingsValues(CALENDAR_STASH_KEY);
  const husket = stash[String(userId)]?.[0];
  const activeCalendar = husket == null ? true : husket === "1";
  await prisma.user.update({ where: { id: userId }, data: { active: true, activeCalendar } });
  if (husket != null) {
    delete stash[String(userId)];
    await setSettingsValues(CALENDAR_STASH_KEY, stash);
  }
  revalidateUsers();
}
