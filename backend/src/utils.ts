import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { config } from "./config.js";

export const asyncRoute = (handler: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function signalHash(ip: string | undefined, userAgent: string | undefined) {
  return createHash("sha256")
    .update(`${config.SIGNAL_PEPPER}:${ip ?? "unknown"}:${userAgent ?? "unknown"}`)
    .digest("hex");
}

export function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56);
}

export function extractXPostId(value: string) {
  try {
    const url = new URL(value);
    if (!/^(?:www\.|mobile\.)?(?:x\.com|twitter\.com)$/i.test(url.hostname)) return null;
    return url.pathname.match(/^\/[^/]+\/status\/([0-9]{1,19})(?:\/|$)/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function retryOnWriteConflict<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 20,
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const isWriteConflict = typeof error === "object"
        && error !== null
        && "code" in error
        && (error as { code?: unknown }).code === "P2034";
      if (!isWriteConflict || attempt === maxAttempts) throw error;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw new Error("Write-conflict retry loop ended unexpectedly.");
}
