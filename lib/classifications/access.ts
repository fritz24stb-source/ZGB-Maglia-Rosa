import type { UserRole } from "@/lib/auth/roles";

export type ClassificationsAudience = "all" | "off" | "staff";
export type GatedClassification = "azzurra" | "ciclamino";

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

export function canAccessClassification(
  role: UserRole | null | undefined,
  classification: GatedClassification,
  value = configuredClassificationValue(classification),
) {
  return canAccessClassifications(role, value);
}

export function canAccessCiclamino(
  role: UserRole | null | undefined,
  value = configuredClassificationValue("ciclamino"),
) {
  return canAccessClassification(role, "ciclamino", value);
}

export function canAccessAzzurra(
  role: UserRole | null | undefined,
  value = configuredClassificationValue("azzurra"),
) {
  return canAccessClassification(role, "azzurra", value);
}

function configuredClassificationValue(classification: GatedClassification) {
  if (classification === "ciclamino") {
    return process.env.CICLAMINO_ENABLED ?? process.env.CLASSIFICATIONS_ENABLED;
  }

  // Azzurra stays closed until it is enabled explicitly. This prevents an
  // existing shared switch from publishing it accidentally during rollout.
  return process.env.AZZURRA_ENABLED;
}
