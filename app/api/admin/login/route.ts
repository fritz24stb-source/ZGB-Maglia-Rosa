import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_PATH,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  getAdminPassword,
} from "@/lib/auth/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    validateOrigin(request);

    const formData = await request.formData();
    const password = normalizeText(formData.get("password"));
    const nextPath = normalizeAdminNextPath(
      normalizeText(formData.get("next")),
    );
    const expectedPassword = getAdminPassword();

    if (!password || password !== expectedPassword) {
      return redirectToLogin(request, nextPath, "invalid");
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url), {
      status: 303,
    });
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      await createAdminSessionToken(expectedPassword),
      {
        httpOnly: true,
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
        path: ADMIN_SESSION_COOKIE_PATH,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
      },
    );

    return response;
  } catch {
    return redirectToLogin(request, "/admin", "config");
  }
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!origin || !appBaseUrl) {
    return;
  }

  if (origin !== new URL(appBaseUrl).origin) {
    throw new Error("Invalid request origin.");
  }
}

function normalizeText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAdminNextPath(value: string | null) {
  if (
    value &&
    value.startsWith("/admin") &&
    !value.startsWith("/admin/login")
  ) {
    return value;
  }

  return "/admin";
}

function redirectToLogin(request: Request, nextPath: string, error: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("next", normalizeAdminNextPath(nextPath));
  url.searchParams.set("error", error);

  return NextResponse.redirect(url, { status: 303 });
}
