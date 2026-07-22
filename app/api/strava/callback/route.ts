import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { signInSupabaseAsAppUser } from "@/lib/auth/app-auth";
import { setAppSessionCookie } from "@/lib/auth/app-session";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";
import { logError } from "@/lib/logger";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import {
  exchangeStravaAuthorizationCode,
  hasLegacyStravaScopes,
  hasRequiredStravaScopes,
} from "@/lib/strava/oauth";
import { runAutomaticUserResync } from "@/lib/strava/automatic-resync";
import { shouldRunAutomaticUserResync } from "@/lib/strava/resync-policy";
import {
  findConnectionByAthleteId,
  findConnectionByUserId,
  upsertStravaConnectionForUser,
} from "@/lib/strava/user-bridge";

const STATE_COOKIE = "strava_oauth_state";

type StravaOAuthState = {
  mode: "connect" | "login";
  state: string;
  userId: string | null;
};

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
    const callbackScope = requestUrl.searchParams.get("scope") ?? "";
    const cookieStore = await cookies();
    const oauthState = decodeOAuthState(cookieStore.get(STATE_COOKIE)?.value);

    if (
      !code ||
      !returnedState ||
      !oauthState ||
      returnedState !== oauthState.state
    ) {
      return redirectWithClearedState(request, "/login", {
        error: "invalid_oauth_state",
      });
    }

    const tokenResponse = await exchangeStravaAuthorizationCode({
      clientId: env.stravaClientId,
      clientSecret: env.stravaClientSecret,
      code,
    });
    const acceptedScope = callbackScope || tokenResponse.scope || "";

    const hasAcceptedScopes =
      hasRequiredStravaScopes(acceptedScope) ||
      (oauthState.mode === "login" && hasLegacyStravaScopes(acceptedScope));

    if (!hasAcceptedScopes) {
      return redirectWithClearedState(request, "/login", {
        error: "missing_strava_scope",
      });
    }
    const serviceClient = createSupabaseServiceRoleClient();
    const athleteId = tokenResponse.athlete?.id;

    if (!athleteId) {
      throw new Error("Strava token response did not include an athlete id.");
    }

    if (oauthState.mode === "connect") {
      const connectionResult = await connectStravaToCurrentUser({
        acceptedScope,
        oauthState,
        request,
        serviceClient,
        tokenResponse,
      });

      if (connectionResult.runAutomaticResync) {
        after(() =>
          runAutomaticUserResync({
            client: serviceClient,
            userId: connectionResult.userId,
            userName: connectionResult.userName,
          }),
        );
      }

      return await redirectWithClearedState(
        request,
        "/profile",
        { connected: "1" },
        connectionResult.userId,
      );
    }

    const signedInUserId = await signInWithLinkedStrava({
      acceptedScope,
      athleteId,
      serviceClient,
      request,
      tokenResponse,
    });

    return await redirectWithClearedState(
      request,
      "/profile",
      {},
      signedInUserId,
    );
  } catch (error) {
    if (error instanceof StravaUserError) {
      return redirectWithClearedState(request, "/login", {
        error: error.code,
      });
    }

    logError("strava.callback.failed", error);

    return redirectWithClearedState(request, "/login", {
      error: "strava_callback_failed",
    });
  }
}

async function connectStravaToCurrentUser(input: {
  acceptedScope: string;
  oauthState: StravaOAuthState;
  request: Request;
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>;
  tokenResponse: Awaited<ReturnType<typeof exchangeStravaAuthorizationCode>>;
}) {
  const accessState = await loadCurrentAppAccessState();

  if (
    accessState.kind !== "active" ||
    accessState.userId !== input.oauthState.userId
  ) {
    throw new StravaUserError("invalid_oauth_state");
  }

  const profile = await getActiveProfile(
    input.serviceClient,
    accessState.userId,
  );
  const athleteId = input.tokenResponse.athlete?.id;

  if (!profile || !athleteId) {
    throw new StravaUserError("account_blocked");
  }

  const [existingConnection, existingUserConnection] = await Promise.all([
    findConnectionByAthleteId(input.serviceClient, athleteId),
    findConnectionByUserId(input.serviceClient, accessState.userId),
  ]);

  if (
    existingConnection &&
    existingConnection.user_id !== accessState.userId &&
    !existingConnection.revoked
  ) {
    throw new StravaUserError("strava_already_linked");
  }

  await upsertStravaConnectionForUser(
    input.serviceClient,
    accessState.userId,
    input.tokenResponse,
    input.acceptedScope,
  );

  return {
    runAutomaticResync: shouldRunAutomaticUserResync(existingUserConnection),
    userId: accessState.userId,
    userName: profile.display_name,
  };
}

async function signInWithLinkedStrava(input: {
  acceptedScope: string;
  athleteId: number;
  request: Request;
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>;
  tokenResponse: Awaited<ReturnType<typeof exchangeStravaAuthorizationCode>>;
}) {
  const connection = await findConnectionByAthleteId(
    input.serviceClient,
    input.athleteId,
  );

  if (!connection || connection.revoked) {
    throw new StravaUserError("strava_not_linked");
  }

  const profile = await getActiveProfile(
    input.serviceClient,
    connection.user_id,
  );

  if (!profile) {
    throw new StravaUserError("account_blocked");
  }

  // A Strava login is also a fresh authorization. Persist its tokens and
  // scopes so an existing connection is upgraded to activity:read_all.
  await upsertStravaConnectionForUser(
    input.serviceClient,
    connection.user_id,
    input.tokenResponse,
    input.acceptedScope,
  );

  const supabase = await createSupabaseServerClient();
  await signInSupabaseAsAppUser({
    displayName: profile.display_name,
    serviceClient: input.serviceClient,
    serverClient: supabase,
    userId: profile.id,
  });

  return profile.id;
}

async function getActiveProfile(
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, display_name, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.is_active ? data : null;
}

async function redirectWithClearedState(
  request: Request,
  pathname: string,
  params: Record<string, string>,
  appSessionUserId?: string,
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

  if (appSessionUserId) {
    await setAppSessionCookie(response, appSessionUserId, request.url);
  }

  return response;
}

function decodeOAuthState(value: string | undefined): StravaOAuthState | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as StravaOAuthState;

    if (
      (decoded.mode === "connect" || decoded.mode === "login") &&
      typeof decoded.state === "string"
    ) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
}

class StravaUserError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "StravaUserError";
  }
}
