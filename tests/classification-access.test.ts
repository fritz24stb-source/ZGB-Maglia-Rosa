import { describe, expect, it } from "vitest";
import {
  canAccessClassifications,
  classificationsAudience,
} from "@/lib/classifications/access";

describe("classification access", () => {
  it("defaults to off when the variable is missing or invalid", () => {
    expect(classificationsAudience(undefined)).toBe("off");
    expect(classificationsAudience("unexpected")).toBe("off");
    expect(canAccessClassifications("admin", undefined)).toBe(false);
  });

  it("allows only admin and scorekeeper in staff mode", () => {
    expect(canAccessClassifications("admin", "staff")).toBe(true);
    expect(canAccessClassifications("scorekeeper", "staff")).toBe(true);
    expect(canAccessClassifications("member", "staff")).toBe(false);
  });

  it("allows every active application role in all mode", () => {
    for (const value of ["true", "1", "all", " TRUE "]) {
      expect(canAccessClassifications("admin", value)).toBe(true);
      expect(canAccessClassifications("scorekeeper", value)).toBe(true);
      expect(canAccessClassifications("member", value)).toBe(true);
    }
  });

  it("blocks every role when explicitly disabled", () => {
    for (const role of ["admin", "scorekeeper", "member"] as const) {
      expect(canAccessClassifications(role, "false")).toBe(false);
      expect(canAccessClassifications(role, "0")).toBe(false);
    }
  });
});
