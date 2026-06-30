import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { logError } from "@/lib/logger";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import {
  exchangeStravaAuthorizationCode,
  hasRequiredStravaScopes,
} from "@/lib/strava/oauth";
import { ensureSupabaseUserForStrava } from "@/lib/strava/user-bridge";

const STATE_COOKIE = "strava_oauth_state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error");

  if (error) {
    return redirectWithClearedState(request, "/login", {
      error: error === "access_denied" ? "strava_denied" : "strava_error",
    });
  }

  try {
    const env = getServerEnv();
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    const acceptedScope = requestUrl.searchParams.get("scope") ?? "";
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STATE_COOKIE)?.value;

    if (
      !code ||
      !returnedState ||
      !expectedState ||
      returnedState !== expectedState
    ) {
      return redirectWithClearedState(request, "/login", {
        error: "invalid_oauth_state",
      });
    }

    if (!hasRequiredStravaScopes(acceptedScope)) {
      return redirectWithClearedState(request, "/login", {
        error: "missing_strava_scope",
      });
    }

    const tokenResponse = await exchangeStravaAuthorizationCode({
      clientId: env.stravaClientId,
      clientSecret: env.stravaClientSecret,
      code,
    });
    const serviceClient = createSupabaseServiceRoleClient();
    const ensuredUser = await ensureSupabaseUserForStrava({
      serviceClient,
      env,
      tokenResponse,
      acceptedScope: acceptedScope || tokenResponse.scope || "",
    });
    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: ensuredUser.email,
      password: ensuredUser.password,
    });

    if (signInError) {
      throw signInError;
    }

    return redirectWithClearedState(request, "/profile", {
      connected: "1",
    });
  } catch (error) {
    logError("strava.callback.failed", error);

    return redirectWithClearedState(request, "/login", {
      error: "strava_callback_failed",
    });
  }
}

function redirectWithClearedState(
  request: Request,
  pathname: string,
  params: Record<string, string>,
) {
  const url = new URL(pathname, request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", {
    maxAge: 0,
    path: "/",
  });

  return response;
}
