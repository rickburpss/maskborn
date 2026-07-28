import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_LIFETIME_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

function signature(payload: string, secret: string) {
  return createHmac("sha256", `${secret}:discord-oauth-state`)
    .update(payload)
    .digest("base64url");
}

export function createOAuthState(secret: string, now = Date.now()) {
  const payload = `${now}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function validateOAuthState(state: string, secret: string, now = Date.now()) {
  if (!state || state.length > 256) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [timestampText, nonce, receivedSignature] = parts;
  if (!timestampText || !/^\d{13}$/.test(timestampText) || !nonce || !receivedSignature) return false;

  const timestamp = Number(timestampText);
  const age = now - timestamp;
  if (!Number.isSafeInteger(timestamp) || age < -CLOCK_SKEW_MS || age > STATE_LIFETIME_MS) return false;

  const expected = Buffer.from(signature(`${timestampText}.${nonce}`, secret), "base64url");
  const received = Buffer.from(receivedSignature, "base64url");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
