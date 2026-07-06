import { NextResponse, type NextRequest } from "next/server";
import {
  APP_SESSION_COOKIE,
  clearAppSessionCookie,
  readAppSessionToken,
  setAppSessionCookie,
} from "@/lib/auth/app-session";
import {
  ADMIN_SESSION_COOKIE,
  hasValidAdminSession,
} from "@/lib/auth/admin-session";

const protectedAppPaths = ["/leaderboard", "/analyse", "/manual", "/profile"];
const protectedAppApiPaths = [
  "/api/leaderboard",
  "/api/manual-entry",
  "/api/passkeys/register",
  "/api/strava/disconnect",
];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
      return NextResponse.next();
    }

    const hasSession = await hasValidAdminSession(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );

    if (hasSession) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  if (!isProtectedAppPath(pathname)) {
    return NextResponse.next();
  }

  const appSession = await readAppSessionToken(
    request.cookies.get(APP_SESSION_COOKIE)?.value,
  );

  if (appSession) {
    const response = NextResponse.next();
    await setAppSessionCookie(response, appSession.userId, request.url);

    return response;
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json(
      { error: "Anmeldung erforderlich." },
      { status: 401 },
    );
    clearAppSessionCookie(response);

    return response;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  const response = NextResponse.redirect(loginUrl);
  clearAppSessionCookie(response);

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/leaderboard/:path*",
    "/analyse/:path*",
    "/manual/:path*",
    "/profile/:path*",
    "/api/leaderboard/:path*",
    "/api/manual-entry/:path*",
    "/api/passkeys/register/:path*",
    "/api/strava/disconnect",
  ],
};

function isProtectedAppPath(pathname: string) {
  return (
    protectedAppPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    protectedAppApiPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  );
}
