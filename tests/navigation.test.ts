import { describe, expect, it } from "vitest";
import { canAccessAdmin, isUserRole } from "@/lib/auth/roles";
import { adminSections, mainNavItems } from "@/lib/navigation";

describe("role and navigation foundation", () => {
  it("accepts only supported roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("member")).toBe(true);
    expect(isUserRole("owner")).toBe(false);
  });

  it("limits admin access to admin role", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("member")).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
  });

  it("keeps admin navigation role-restricted", () => {
    const adminItem = mainNavItems.find((item) => item.href === "/admin");

    expect(adminItem?.roles).toEqual(["admin"]);
    expect(adminSections.length).toBeGreaterThanOrEqual(5);
  });
});
