import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_PATH,
} from "@/lib/auth/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), {
    status: 303,
  });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    maxAge: 0,
    path: ADMIN_SESSION_COOKIE_PATH,
  });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    maxAge: 0,
    path: "/admin",
  });

  return response;
}
