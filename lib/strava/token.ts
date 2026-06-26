import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import {
  epochSecondsToIso,
  shouldRefreshAccessToken,
} from "@/lib/strava/token-policy";
import { refreshStravaToken } from "@/lib/strava/oauth";
import type { Database } from "@/types/database";

type StravaConnection =
  Database["public"]["Tables"]["strava_connections"]["Row"];

export class StravaConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StravaConnectionError";
  }
}

export async function getValidStravaAccessTokenForUser(userId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: connection, error } = await supabase
    .from("strava_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new StravaConnectionError(error.message);
  }

  if (!connection) {
    throw new StravaConnectionError("No Strava connection found for user.");
  }

  return getValidStravaAccessToken(connection);
}

export async function getValidStravaAccessToken(connection: StravaConnection) {
  if (connection.revoked) {
    throw new StravaConnectionError("Strava connection has been revoked.");
  }

  if (
    connection.access_token &&
    !shouldRefreshAccessToken(connection.expires_at)
  ) {
    return connection.access_token;
  }

  const env = getServerEnv();
  const refreshed = await refreshStravaToken({
    clientId: env.stravaClientId,
    clientSecret: env.stravaClientSecret,
    refreshToken: connection.refresh_token,
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("strava_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: epochSecondsToIso(refreshed.expires_at),
      revoked: false,
    })
    .eq("id", connection.id);

  if (error) {
    throw new StravaConnectionError(error.message);
  }

  return refreshed.access_token;
}
