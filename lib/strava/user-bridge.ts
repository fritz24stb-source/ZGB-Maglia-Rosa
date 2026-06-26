import "server-only";

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerEnv } from "@/lib/env";
import { epochSecondsToIso } from "@/lib/strava/token-policy";
import type { StravaAthlete, StravaTokenResponse } from "@/lib/strava/oauth";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

type EnsureStravaUserInput = {
  serviceClient: ServiceClient;
  env: ServerEnv;
  tokenResponse: StravaTokenResponse;
  acceptedScope: string;
};

export type EnsuredStravaUser = {
  userId: string;
  email: string;
  password: string;
  displayName: string;
};

export async function ensureSupabaseUserForStrava({
  serviceClient,
  env,
  tokenResponse,
  acceptedScope,
}: EnsureStravaUserInput): Promise<EnsuredStravaUser> {
  if (!tokenResponse.athlete?.id) {
    throw new Error("Strava token response did not include an athlete id.");
  }

  const athlete = tokenResponse.athlete;
  const athleteId = athlete.id;
  const email = buildSyntheticStravaEmail(athleteId);
  const password = buildSyntheticStravaPassword(athleteId, env);
  const displayName = buildStravaDisplayName(athlete);

  const existingConnection = await findConnectionByAthleteId(
    serviceClient,
    athleteId,
  );
  const existingUser = existingConnection?.user_id
    ? await getAuthUserById(serviceClient, existingConnection.user_id)
    : await findAuthUserByEmail(serviceClient, email);

  const user =
    existingUser ??
    (await createAuthUser(serviceClient, email, password, athleteId));

  await updateAuthUser(
    serviceClient,
    user.id,
    password,
    athleteId,
    displayName,
  );
  await upsertProfile(serviceClient, user.id, displayName);
  await upsertStravaConnection(
    serviceClient,
    user.id,
    tokenResponse,
    acceptedScope,
  );

  return {
    userId: user.id,
    email,
    password,
    displayName,
  };
}

export function buildStravaDisplayName(athlete: StravaAthlete) {
  const name = [athlete.firstname, athlete.lastname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return name || athlete.username || `Strava ${athlete.id}`;
}

export function buildSyntheticStravaEmail(athleteId: number) {
  return `strava-${athleteId}@members.zgb-strava.local`;
}

export function buildSyntheticStravaPassword(
  athleteId: number,
  env: ServerEnv,
) {
  return createHmac(
    "sha256",
    `${env.supabaseServiceRoleKey}:${env.stravaClientSecret}`,
  )
    .update(`strava:${athleteId}`)
    .digest("hex");
}

async function findConnectionByAthleteId(
  serviceClient: ServiceClient,
  athleteId: number,
) {
  const { data, error } = await serviceClient
    .from("strava_connections")
    .select("user_id")
    .eq("strava_athlete_id", athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getAuthUserById(serviceClient: ServiceClient, userId: string) {
  const { data, error } = await serviceClient.auth.admin.getUserById(userId);

  if (error) {
    return null;
  }

  return data.user;
}

async function findAuthUserByEmail(
  serviceClient: ServiceClient,
  email: string,
) {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createAuthUser(
  serviceClient: ServiceClient,
  email: string,
  password: string,
  athleteId: number,
) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      auth_provider: "strava",
      strava_athlete_id: athleteId,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Supabase did not return a user after createUser.");
  }

  return data.user;
}

async function updateAuthUser(
  serviceClient: ServiceClient,
  userId: string,
  password: string,
  athleteId: number,
  displayName: string,
) {
  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: {
      auth_provider: "strava",
      display_name: displayName,
      strava_athlete_id: athleteId,
    },
  });

  if (error) {
    throw error;
  }
}

async function upsertProfile(
  serviceClient: ServiceClient,
  userId: string,
  displayName: string,
) {
  const { data: existingProfile, error: selectError } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    const { error } = await serviceClient
      .from("profiles")
      .update({
        display_name: displayName,
        is_active: true,
      })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await serviceClient.from("profiles").insert({
    id: userId,
    display_name: displayName,
    role: "member",
    is_active: true,
  });

  if (error) {
    throw error;
  }
}

async function upsertStravaConnection(
  serviceClient: ServiceClient,
  userId: string,
  tokenResponse: StravaTokenResponse,
  acceptedScope: string,
) {
  const athleteId = tokenResponse.athlete?.id;

  if (!athleteId) {
    throw new Error("Cannot store Strava connection without athlete id.");
  }

  const { error } = await serviceClient.from("strava_connections").upsert(
    {
      user_id: userId,
      strava_athlete_id: athleteId,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: epochSecondsToIso(tokenResponse.expires_at),
      scope: acceptedScope,
      revoked: false,
    },
    { onConflict: "strava_athlete_id" },
  );

  if (error) {
    throw error;
  }
}
