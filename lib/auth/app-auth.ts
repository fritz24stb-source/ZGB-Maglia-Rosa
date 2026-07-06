import "server-only";

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppAuthSecret } from "@/lib/auth/app-session";
import {
  normalizeDisplayName,
  normalizeDisplayNameKey,
} from "@/lib/auth/names";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const APP_AUTH_EMAIL_DOMAIN = "members.zgb-app.local";

export type ActiveAppProfile = Pick<
  ProfileRow,
  "display_name" | "id" | "is_active" | "role"
>;

export function buildAppAuthEmail(userId: string) {
  return `member-${userId}@${APP_AUTH_EMAIL_DOMAIN}`;
}

export function buildAppAuthPassword(userId: string) {
  return createHmac("sha256", getAppAuthSecret())
    .update(`app-auth:${userId}`)
    .digest("hex");
}

export async function createAppAuthUser(
  serviceClient: ServiceClient,
  displayName: string,
) {
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const pendingId = randomUUID();
  const { data, error } = await serviceClient.auth.admin.createUser({
    email: `pending-${pendingId}@${APP_AUTH_EMAIL_DOMAIN}`,
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: {
      auth_provider: "app",
      display_name: normalizedDisplayName,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Supabase did not return a user after createUser.");
  }

  await ensureSupabaseAuthBridgeCredentials(
    serviceClient,
    data.user.id,
    normalizedDisplayName,
  );

  return data.user.id;
}

export async function ensureSupabaseAuthBridgeCredentials(
  serviceClient: ServiceClient,
  userId: string,
  displayName?: string | null,
) {
  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    email: buildAppAuthEmail(userId),
    password: buildAppAuthPassword(userId),
    email_confirm: true,
    user_metadata: {
      auth_provider: "app",
      display_name: displayName ?? undefined,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signInSupabaseAsAppUser(input: {
  displayName?: string | null;
  serviceClient: ServiceClient;
  serverClient: ServerClient;
  userId: string;
}) {
  await ensureSupabaseAuthBridgeCredentials(
    input.serviceClient,
    input.userId,
    input.displayName,
  );

  const { error } = await input.serverClient.auth.signInWithPassword({
    email: buildAppAuthEmail(input.userId),
    password: buildAppAuthPassword(input.userId),
  });

  if (error) {
    throw error;
  }
}

export async function findProfileByDisplayName(
  serviceClient: ServiceClient,
  displayName: string,
) {
  const normalizedKey = normalizeDisplayNameKey(displayName);
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, display_name, role, is_active")
    .limit(10000);

  if (error) {
    throw error;
  }

  const matches = ((data ?? []) as ActiveAppProfile[]).filter(
    (profile) =>
      normalizeDisplayNameKey(profile.display_name) === normalizedKey,
  );

  if (matches.length > 1) {
    throw new Error("Dieser Name ist mehreren Profilen zugeordnet.");
  }

  return matches[0] ?? null;
}

export async function assertDisplayNameAvailable(
  serviceClient: ServiceClient,
  displayName: string,
  options: { exceptUserId?: string } = {},
) {
  const existingProfile = await findProfileByDisplayName(
    serviceClient,
    displayName,
  );

  if (
    existingProfile &&
    (!options.exceptUserId || existingProfile.id !== options.exceptUserId)
  ) {
    throw new Error("Dieser Name ist bereits vergeben.");
  }
}

export async function getPasswordCredential(
  serviceClient: ServiceClient,
  userId: string,
) {
  const { data, error } = await serviceClient
    .from("app_user_credentials")
    .select("user_id, password_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Pick<
    Database["public"]["Tables"]["app_user_credentials"]["Row"],
    "password_hash" | "user_id"
  > | null;
}

export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
