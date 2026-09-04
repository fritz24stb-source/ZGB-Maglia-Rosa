import type { UserRole } from "@/lib/auth/roles";

export type ClassificationsAudience = "all" | "off" | "staff";

export function classificationsAudience(
  value = process.env.CLASSIFICATIONS_ENABLED,
): ClassificationsAudience {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "all") {
    return "all";
  }

  if (normalized === "staff") {
    return "staff";
  }

  return "off";
}

export function canAccessClassifications(
  role: UserRole | null | undefined,
  value = process.env.CLASSIFICATIONS_ENABLED,
) {
  const audience = classificationsAudience(value);

  if (audience === "all") {
    return role === "admin" || role === "scorekeeper" || role === "member";
  }

  return audience === "staff" && (role === "admin" || role === "scorekeeper");
}
