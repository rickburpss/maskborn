import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_LIFETIME_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
export type OAuthIntent = "login" | "link";

function signature(payload: string, secret: string) {
  return createHmac("sha256", `${secret}:discord-oauth-state`)
    .update(payload)
    .digest("base64url");
}

export function createOAuthState(secret: string, intent: OAuthIntent = "link", now = Date.now()) {
  const payload = `${now}.${intent}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function readOAuthState(state: string, secret: string, now = Date.now()): OAuthIntent | null {
  if (!state || state.length > 256) return null;
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [timestampText, intent, nonce, receivedSignature] = parts;
  if (
    !timestampText
    || !/^\d{13}$/.test(timestampText)
    || !["login", "link"].includes(intent ?? "")
    || !nonce
    || !receivedSignature
  ) return null;

  const timestamp = Number(timestampText);
  const age = now - timestamp;
  if (!Number.isSafeInteger(timestamp) || age < -CLOCK_SKEW_MS || age > STATE_LIFETIME_MS) return null;

  const expected = Buffer.from(signature(`${timestampText}.${intent}.${nonce}`, secret), "base64url");
  const received = Buffer.from(receivedSignature, "base64url");
  return expected.length === received.length && timingSafeEqual(expected, received)
    ? intent as OAuthIntent
    : null;
}

export function validateOAuthState(state: string, secret: string, now = Date.now()) {
  return readOAuthState(state, secret, now) !== null;
}
