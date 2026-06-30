import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  hasValidAdminSession,
} from "@/lib/auth/admin-session";
import { logError } from "@/lib/logger";
import { isStravaRateLimitError } from "@/lib/strava/errors";

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
  const hasSession = await hasValidAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!hasSession) {
    throw new AdminHttpError(401, "Admin-Anmeldung erforderlich.");
  }
}

export function validateAdminOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const expectedOrigin = getExpectedOrigin(request);

  if (origin !== expectedOrigin) {
    throw new AdminHttpError(403, "Ungueltiger Request-Origin.");
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
    return "Supabase oder Admin-Konfiguration fehlt. Bitte .env.local pruefen.";
  }

  return "Admin-Aktion konnte nicht ausgefuehrt werden. Details stehen im Server-Log.";
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
