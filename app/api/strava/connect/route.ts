import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";
import { logError } from "@/lib/logger";
import { buildStravaAuthorizeUrl } from "@/lib/strava/oauth";

const STATE_COOKIE = "strava_oauth_state";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

type StravaOAuthState = {
  mode: "connect" | "login";
  state: string;
  userId: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const env = getServerEnv();
    const state = randomBytes(32).toString("hex");
    const oauthState = await buildOAuthState(state, request);
    const redirectUri = new URL("/api/strava/callback", env.appBaseUrl);
    const authorizeUrl = buildStravaAuthorizeUrl({
      clientId: env.stravaClientId,
      redirectUri: redirectUri.toString(),
      state,
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(STATE_COOKIE, encodeOAuthState(oauthState), {
      httpOnly: true,
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: env.appBaseUrl.startsWith("https://"),
    });

    return response;
  } catch (error) {
    if (error instanceof RedirectError) {
      return NextResponse.redirect(error.url);
    }

    logError("strava.connect.failed", error);

    const url = new URL("/login", request.url);
    url.searchParams.set("error", "config");

    return NextResponse.redirect(url);
  }
}

async function buildOAuthState(
  state: string,
  request: Request,
): Promise<StravaOAuthState> {
  const accessState = await loadCurrentAppAccessState();

  if (accessState.kind === "anonymous") {
    return { mode: "login", state, userId: null };
  }

  if (accessState.kind === "blocked") {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "account_blocked");
    throw new RedirectError(url);
  }

  return { mode: "connect", state, userId: accessState.userId };
}

function encodeOAuthState(state: StravaOAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

class RedirectError extends Error {
  constructor(readonly url: URL) {
    super("Redirect");
    this.name = "RedirectError";
  }
}
