// Single shared Prisma client. In dev, Next.js hot-reload re-evaluates modules
// on every edit; without this global cache each reload would open a new pool of
// SQLite connections and eventually exhaust them.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** True if the error is a Prisma unique-constraint violation (P2002). Used to
 *  retry app-allocated numbers (displayNo) that can race on concurrent creates. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/** Venlig fejlbesked, når Tilbud-tabellerne mangler i databasen (fx preview,
 *  hvor migreringer først køres ved production-build). */
export const TILBUD_TABELLER_MANGLER =
  "Tilbud-tabellerne findes ikke i denne testudgaves database — modulet virker fuldt, når det sættes live.";

/** True if the error is a missing-table error (P2021) for en af Tilbud-tabel-
 *  lerne (Tilbud/TilbudLine/TilbudPhoto). Lader opret-flowet degradere med en
 *  venlig besked i stedet for at crashe — samme mønster som isUniqueViolation. */
export function isTilbudTableMissing(e: unknown): boolean {
  return typeof e === "object" && e !== null
    && (e as { code?: string }).code === "P2021"
    && typeof (e as { meta?: { table?: string } }).meta?.table === "string"
    && /Tilbud/.test((e as { meta: { table: string } }).meta.table);
}
