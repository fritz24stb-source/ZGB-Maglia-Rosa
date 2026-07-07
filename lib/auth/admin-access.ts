import { canAccessAdmin, type UserRole } from "@/lib/auth/roles";

export const ADMIN_ACCESS_REQUIRED_MESSAGE = "Admin-Rolle erforderlich.";
export const LAST_ACTIVE_ADMIN_MESSAGE =
  "Mindestens ein aktiver Admin muss erhalten bleiben.";

export type AdminAccessProfile = {
  display_name?: string;
  id: string;
  is_active: boolean;
  role: UserRole;
};

export type AdminAccessDecision =
  | { allowed: true }
  | { allowed: false; message: string; status: 401 | 403 };

export function decideAdminAccess(
  profile: AdminAccessProfile | null | undefined,
): AdminAccessDecision {
  if (!profile) {
    return {
      allowed: false,
      message: "Anmeldung erforderlich.",
      status: 401,
    };
  }

  if (!profile.is_active) {
    return {
      allowed: false,
      message: "Dieses Profil ist gesperrt.",
      status: 403,
    };
  }

  if (!canAccessAdmin(profile.role)) {
    return {
      allowed: false,
      message: ADMIN_ACCESS_REQUIRED_MESSAGE,
      status: 403,
    };
  }

  return { allowed: true };
}

export function isActiveAdminProfile(
  profile: Pick<AdminAccessProfile, "is_active" | "role">,
) {
  return profile.is_active && profile.role === "admin";
}

export function removesActiveAdminAccess(
  before: Pick<AdminAccessProfile, "is_active" | "role">,
  after: Pick<AdminAccessProfile, "is_active" | "role"> | null,
) {
  return (
    isActiveAdminProfile(before) && (!after || !isActiveAdminProfile(after))
  );
}
