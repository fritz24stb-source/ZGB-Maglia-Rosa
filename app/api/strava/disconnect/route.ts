import { NextResponse } from "next/server";
import { clearAppSessionCookie } from "@/lib/auth/app-session";
import { requireActiveAppUser } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { logError, logWarn } from "@/lib/logger";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { revokeStravaToken } from "@/lib/strava/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(env.appBaseUrl).origin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const access = await requireActiveAppUser();
    const supabase = await createSupabaseServerClient();
    const serviceClient = createSupabaseServiceRoleClient();
    const { data: connection, error } = await serviceClient
      .from("strava_connections")
      .select("id, refresh_token, revoked")
      .eq("user_id", access.userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    let revokeWarning = false;

    if (connection && !connection.revoked) {
      try {
        await revokeStravaToken({
          clientId: env.stravaClientId,
          clientSecret: env.stravaClientSecret,
          token: connection.refresh_token,
          tokenTypeHint: "refresh_token",
        });
      } catch (error) {
        logWarn("strava.disconnect.revoke_failed", {
          connectionId: connection.id,
          error,
        });
        revokeWarning = true;
      }

      const { error: updateError } = await serviceClient
        .from("strava_connections")
        .update({
          access_token: null,
          revoked: true,
        })
        .eq("id", connection.id);

      if (updateError) {
        throw updateError;
      }
    }

    await supabase.auth.signOut();

    const url = new URL("/login", request.url);
    url.searchParams.set("disconnected", "1");

    if (revokeWarning) {
      url.searchParams.set("warning", "strava_revoke_failed");
    }

    const response = NextResponse.redirect(url, { status: 303 });
    clearAppSessionCookie(response);

    return response;
  } catch (error) {
    logError("strava.disconnect.failed", error);

    const url = new URL("/profile", request.url);
    url.searchParams.set("error", "disconnect_failed");

    return NextResponse.redirect(url, { status: 303 });
  }
}
