// Single shared Prisma client. In dev, Next.js hot-reload re-evaluates modules
// on every edit; without this global cache each reload would open a new pool of
// SQLite connections and eventually exhaust them.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
