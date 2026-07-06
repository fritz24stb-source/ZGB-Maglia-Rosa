import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAppSessionToken,
  readAppSessionToken,
} from "@/lib/auth/app-session";
import {
  normalizeDisplayName,
  normalizeDisplayNameKey,
} from "@/lib/auth/names";
import {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from "@/lib/auth/password";

describe("access control helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes display names and keys consistently", () => {
    expect(normalizeDisplayName("  Max   Muster  ")).toBe("Max Muster");
    expect(normalizeDisplayNameKey("  Max   Muster  ")).toBe("max muster");
  });

  it("accepts simple long passphrases but rejects weak passwords", () => {
    expect(() =>
      validatePasswordPolicy("wintertraining2026", "Max Muster"),
    ).not.toThrow();
    expect(() => validatePasswordPolicy("1234567890", "Max Muster")).toThrow(
      "Dieses Passwort ist zu leicht zu erraten.",
    );
    expect(() =>
      validatePasswordPolicy("MaxMuster2026!", "Max Muster"),
    ).toThrow("Passwort darf den Namen nicht enthalten.");
  });

  it("hashes and verifies passwords with scrypt", async () => {
    const passwordHash = await hashPassword("wintertraining2026");

    expect(await verifyPassword("wintertraining2026", passwordHash)).toBe(true);
    expect(await verifyPassword("anderes-passwort", passwordHash)).toBe(false);
  });

  it("validates signed app sessions for seven days", async () => {
    vi.stubEnv("APP_AUTH_SECRET", "test-app-secret");

    const issuedAt = new Date("2026-07-06T10:00:00.000Z");
    const token = await createAppSessionToken("user-1", issuedAt);

    expect(
      await readAppSessionToken(token, new Date("2026-07-13T09:59:59.000Z")),
    ).toEqual({ issuedAt: 1783332000, userId: "user-1" });
    expect(
      await readAppSessionToken(token, new Date("2026-07-13T10:00:01.000Z")),
    ).toBeNull();
  });
});
