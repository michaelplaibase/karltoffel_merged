// Brugere — dataadgang til brugerstyringen (kun admin-flader).
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type UserRow = {
  id: number;
  username: string;
  navn: string;
  firstName: string;
  lastName: string;
  email: string | null;
  rolle: "admin" | "medarbejder";
  kanLogge: boolean;
  calendarColor: string | null;
  activeCalendar: boolean;
  canReceiveOnline: boolean;
  homeAddress: string | null;
  canSeePrices: boolean;
  canEditOrders: boolean;
  canHandlePayment: boolean;
  canChangePaymentOption: boolean;
  payModel: "fast" | "akkord";
  commissionPct: number | null;
  monthlySalary: number | null;
  active: boolean;
};

// Aldrig selve hash-indholdet ud af dette modul — kun kanLogge-booleanen.
const SELECT = {
  id: true, username: true, firstName: true, lastName: true, email: true,
  calendarColor: true, activeCalendar: true, canReceiveOnline: true, homeAddress: true,
  isAdmin: true, canSeePrices: true, canEditOrders: true, canHandlePayment: true,
  canChangePaymentOption: true, passwordHash: true, payModel: true,
  commissionPct: true, monthlySalary: true, active: true,
} as const;

type UserSelected = Prisma.UserGetPayload<{ select: typeof SELECT }>;

function mapUser(u: UserSelected): UserRow {
  return {
    id: u.id,
    username: u.username,
    navn: `${u.firstName} ${u.lastName}`.trim(),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    rolle: u.isAdmin ? "admin" : "medarbejder",
    kanLogge: u.passwordHash != null,
    calendarColor: u.calendarColor,
    activeCalendar: u.activeCalendar,
    canReceiveOnline: u.canReceiveOnline,
    homeAddress: u.homeAddress,
    canSeePrices: u.canSeePrices,
    canEditOrders: u.canEditOrders,
    canHandlePayment: u.canHandlePayment,
    canChangePaymentOption: u.canChangePaymentOption,
    payModel: u.payModel === "akkord" ? "akkord" : "fast",
    commissionPct: u.commissionPct,
    monthlySalary: u.monthlySalary,
    active: u.active,
  };
}

export async function getUsers(includeInactive = false): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ isAdmin: "desc" }, { username: "asc" }],
    select: SELECT,
  });
  return users.map(mapUser);
}

/** Én bruger til redigeringssiden (/users/[id]/edit). */
export async function getUser(id: number): Promise<UserRow | null> {
  const u = await prisma.user.findUnique({ where: { id }, select: SELECT });
  return u ? mapUser(u) : null;
}
