import { describe, expect, it } from "vitest";
import { createOAuthState, readOAuthState, validateOAuthState } from "./oauth-state.js";

describe("Discord OAuth state", () => {
  const secret = "test-signal-pepper-that-is-long-enough";
  const now = 1_800_000_000_000;

  it("accepts a fresh signed state without requiring a cookie", () => {
    const state = createOAuthState(secret, "link", now);
    expect(validateOAuthState(state, secret, now + 30_000)).toBe(true);
    expect(readOAuthState(state, secret, now + 30_000)).toBe("link");
    expect(readOAuthState(createOAuthState(secret, "login", now), secret, now)).toBe("login");
  });

  it("rejects tampered, expired, and differently signed states", () => {
    const state = createOAuthState(secret, "login", now);
    expect(validateOAuthState(`${state}x`, secret, now)).toBe(false);
    expect(validateOAuthState(state, "different-secret-that-is-long-enough", now)).toBe(false);
    expect(validateOAuthState(state, secret, now + 10 * 60 * 1000 + 1)).toBe(false);
  });
});
