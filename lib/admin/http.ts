import { NextResponse, type NextRequest } from "next/server";
import {
  APP_SESSION_COOKIE,
  readAppSessionToken,
} from "@/lib/auth/app-session";
import { decideAdminAccess } from "@/lib/auth/admin-access";
import { logError } from "@/lib/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isStravaRateLimitError } from "@/lib/strava/errors";
import type { Database } from "@/types/database";

type AdminProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id" | "is_active" | "role"
>;

export class AdminHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminHttpError";
  }
}

export async function requireAdminSession(request: NextRequest) {
  const appSession = await readAppSessionToken(
    request.cookies.get(APP_SESSION_COOKIE)?.value,
  );

  if (!appSession) {
    throw new AdminHttpError(401, "Anmeldung erforderlich.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, is_active")
    .eq("id", appSession.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const profile = data as AdminProfile | null;
  const decision = decideAdminAccess(profile);

  if (!decision.allowed) {
    throw new AdminHttpError(decision.status, decision.message);
  }

  return { profile, userId: appSession.userId };
}

export function validateAdminOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const expectedOrigin = getExpectedOrigin(request);

  if (origin !== expectedOrigin) {
    throw new AdminHttpError(403, "Ungültiger Request-Origin.");
  }
}

export function redirectWithAdminFlash(
  request: NextRequest,
  fallbackPath: string,
  flash: { error?: string; status?: string },
) {
  const url = getSafeAdminRefererUrl(request, fallbackPath);

  url.searchParams.delete("adminStatus");
  url.searchParams.delete("adminError");

  if (flash.status) {
    url.searchParams.set("adminStatus", flash.status);
  }

  if (flash.error) {
    url.searchParams.set("adminError", flash.error);
  }

  return NextResponse.redirect(url, { status: 303 });
}

export function formatAdminError(error: unknown) {
  logError("admin.action.failed", error);

  if (error instanceof AdminHttpError) {
    return error.message;
  }

  if (isStravaRateLimitError(error) && error instanceof Error) {
    return error.message;
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return "Supabase- oder App-Konfiguration fehlt. Bitte .env.local prüfen.";
  }

  return "Admin-Aktion konnte nicht ausgeführt werden. Details stehen im Server-Log.";
}

export function getSafeAdminRefererUrl(
  request: NextRequest,
  fallbackPath: string,
) {
  const requestUrl = new URL(request.url);
  const referer = request.headers.get("referer");

  if (!referer) {
    return new URL(fallbackPath, request.url);
  }

  try {
    const refererUrl = new URL(referer);

    if (
      refererUrl.origin === requestUrl.origin &&
      refererUrl.pathname.startsWith("/admin")
    ) {
      return refererUrl;
    }
  } catch {
    // Ignore malformed referers and use the fallback path.
  }

  return new URL(fallbackPath, request.url);
}

function getExpectedOrigin(request: NextRequest) {
  const appBaseUrl = process.env.APP_BASE_URL;

  if (appBaseUrl) {
    return new URL(appBaseUrl).origin;
  }

  return new URL(request.url).origin;
}
