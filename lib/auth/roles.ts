export const userRoles = ["admin", "member", "scorekeeper"] as const;

export type UserRole = (typeof userRoles)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}

export function canAccessAdmin(role: UserRole | null | undefined) {
  return role === "admin";
}

export function canManageCiclamino(role: UserRole | null | undefined) {
  return role === "admin" || role === "scorekeeper";
}
