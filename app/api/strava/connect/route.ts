import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { logError } from "@/lib/logger";
import { buildStravaAuthorizeUrl } from "@/lib/strava/oauth";

const STATE_COOKIE = "strava_oauth_state";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const env = getServerEnv();
    const state = randomBytes(32).toString("hex");
    const redirectUri = new URL("/api/strava/callback", env.appBaseUrl);
    const authorizeUrl = buildStravaAuthorizeUrl({
      clientId: env.stravaClientId,
      redirectUri: redirectUri.toString(),
      state,
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: env.appBaseUrl.startsWith("https://"),
    });

    return response;
  } catch (error) {
    logError("strava.connect.failed", error);

    const url = new URL("/login", request.url);
    url.searchParams.set("error", "config");

    return NextResponse.redirect(url);
  }
}
