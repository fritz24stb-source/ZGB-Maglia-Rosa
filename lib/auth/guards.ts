import "server-only";

import { cookies } from "next/headers";
import {
  APP_SESSION_COOKIE,
  readAppSessionToken,
} from "@/lib/auth/app-session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id" | "is_active" | "role"
>;

export type AppAccessState =
  | { kind: "anonymous" }
  | { kind: "blocked"; profile: ProfileRow; userId: string }
  | { kind: "active"; profile: ProfileRow; userId: string };

export class AppAccessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppAccessError";
  }
}

export async function loadCurrentAppAccessState(): Promise<AppAccessState> {
  const cookieStore = await cookies();
  const appSession = await readAppSessionToken(
    cookieStore.get(APP_SESSION_COOKIE)?.value,
  );

  if (!appSession) {
    return { kind: "anonymous" };
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, display_name, role, is_active")
    .eq("id", appSession.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { kind: "anonymous" };
  }

  const profile = data as ProfileRow;

  if (!profile.is_active) {
    return { kind: "blocked", profile, userId: appSession.userId };
  }

  return { kind: "active", profile, userId: appSession.userId };
}

export async function requireActiveAppUser() {
  const state = await loadCurrentAppAccessState();

  if (state.kind === "anonymous") {
    throw new AppAccessError(401, "Anmeldung erforderlich.");
  }

  if (state.kind === "blocked") {
    throw new AppAccessError(403, "Dieses Profil ist gesperrt.");
  }

  return state;
}
