import { describe, expect, it } from "vitest";
import {
  ADMIN_ACCESS_REQUIRED_MESSAGE,
  LAST_ACTIVE_ADMIN_MESSAGE,
  decideAdminAccess,
  removesActiveAdminAccess,
} from "@/lib/auth/admin-access";

describe("admin role access", () => {
  it("allows only active admin profiles", () => {
    expect(
      decideAdminAccess({
        display_name: "Admin",
        id: "user-admin",
        is_active: true,
        role: "admin",
      }),
    ).toEqual({ allowed: true });

    expect(
      decideAdminAccess({
        display_name: "Member",
        id: "user-member",
        is_active: true,
        role: "member",
      }),
    ).toEqual({
      allowed: false,
      message: ADMIN_ACCESS_REQUIRED_MESSAGE,
      status: 403,
    });

    expect(decideAdminAccess(null)).toEqual({
      allowed: false,
      message: "Anmeldung erforderlich.",
      status: 401,
    });
  });

  it("detects updates that remove active admin access", () => {
    const activeAdmin = { is_active: true, role: "admin" as const };

    expect(
      removesActiveAdminAccess(activeAdmin, {
        is_active: true,
        role: "member",
      }),
    ).toBe(true);
    expect(
      removesActiveAdminAccess(activeAdmin, {
        is_active: false,
        role: "admin",
      }),
    ).toBe(true);
    expect(removesActiveAdminAccess(activeAdmin, null)).toBe(true);
    expect(
      removesActiveAdminAccess(activeAdmin, {
        is_active: true,
        role: "admin",
      }),
    ).toBe(false);
  });

  it("keeps a stable message for last-admin protection", () => {
    expect(LAST_ACTIVE_ADMIN_MESSAGE).toBe(
      "Mindestens ein aktiver Admin muss erhalten bleiben.",
    );
  });
});
