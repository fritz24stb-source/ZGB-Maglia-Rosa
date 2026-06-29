import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdminSessionToken,
  getAdminPassword,
  hasValidAdminSession,
} from "@/lib/auth/admin-session";

describe("admin session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs and validates the admin session token with ADMIN_PASSWORD", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "test-admin-password");

    const token = await createAdminSessionToken();

    expect(await hasValidAdminSession(token)).toBe(true);
    expect(await hasValidAdminSession(`${token}x`)).toBe(false);
  });

  it("requires ADMIN_PASSWORD for token creation", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");

    expect(() => getAdminPassword()).toThrow(
      "Missing required environment variable: ADMIN_PASSWORD",
    );
  });
});
