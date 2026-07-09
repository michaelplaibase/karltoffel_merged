// Brugere — dataadgang til brugerstyringen (kun admin-flader).
import { prisma } from "@/lib/db";

export type UserRow = {
  id: number;
  username: string;
  navn: string;
  email: string | null;
  rolle: "admin" | "medarbejder";
  kanLogge: boolean;
};

export async function getUsers(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ isAdmin: "desc" }, { username: "asc" }],
    select: { id: true, username: true, firstName: true, lastName: true, email: true, isAdmin: true, passwordHash: true },
  });
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    navn: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    rolle: u.isAdmin ? "admin" : "medarbejder",
    kanLogge: u.passwordHash != null,
  }));
}
