import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const adapter = new PrismaNeon({ connectionString: config.DATABASE_URL });

export const db = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
