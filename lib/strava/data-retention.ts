import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStravaActivityErasurePatch,
  buildStravaConnectionDisconnectPatch,
} from "@/lib/strava/data-retention-helpers";
import type { Database, Json } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

type StravaActivityForErasure = {
  id: string;
  activity_started_at: string;
  strava_activity_id: number | null;
};

export type StravaDataPurgeSummary = {
  activitiesErased: number;
  auditLogsRedacted: boolean;
  connectionsRemoved: number;
  webhookEventsDeleted: boolean;
};

export {
  buildStravaActivityErasurePatch,
  buildStravaConnectionDisconnectPatch,
  ERASED_STRAVA_ACTIVITY_NAME,
  normalizeActivityStartedAtForErasure,
} from "@/lib/strava/data-retention-helpers";

export async function disconnectStravaForUser(
  client: ServiceClient,
  userId: string,
) {
  const { data, error } = await client
    .from("strava_connections")
    .update(buildStravaConnectionDisconnectPatch())
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    connectionId: data?.id ?? null,
  };
}

export async function purgeStravaDataForUser(
  client: ServiceClient,
  userId: string,
  erasedAt = new Date(),
): Promise<StravaDataPurgeSummary> {
  const [athleteIds, activities] = await Promise.all([
    loadStravaAthleteIdsForUser(client, userId),
    loadStravaActivitiesForUser(client, userId),
  ]);
  const stravaActivityIds = activities
    .map((activity) => activity.strava_activity_id)
    .filter((id): id is number => id !== null);

  await eraseActivities(client, activities, erasedAt);
  const connectionsRemoved = await deleteStravaConnectionsForUser(
    client,
    userId,
  );
  const webhookEventsDeleted = await deleteWebhookEvents(
    client,
    athleteIds,
    stravaActivityIds,
  );
  const auditLogsRedacted = await redactAuditLogsForActivities(
    client,
    activities.map((activity) => activity.id),
    erasedAt,
  );

  return {
    activitiesErased: activities.length,
    auditLogsRedacted,
    connectionsRemoved,
    webhookEventsDeleted,
  };
}

async function loadStravaAthleteIdsForUser(
  client: ServiceClient,
  userId: string,
) {
  const { data, error } = await client
    .from("strava_connections")
    .select("strava_athlete_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((connection) => connection.strava_athlete_id);
}

async function loadStravaActivitiesForUser(
  client: ServiceClient,
  userId: string,
) {
  const { data, error } = await client
    .from("activities")
    .select("id, activity_started_at, strava_activity_id")
    .eq("user_id", userId)
    .eq("source", "strava");

  if (error) {
    throw error;
  }

  return (data ?? []) as StravaActivityForErasure[];
}

async function eraseActivities(
  client: ServiceClient,
  activities: StravaActivityForErasure[],
  erasedAt: Date,
) {
  for (const activity of activities) {
    const { error } = await client
      .from("activities")
      .update(
        buildStravaActivityErasurePatch(activity.activity_started_at, erasedAt),
      )
      .eq("id", activity.id);

    if (error) {
      throw error;
    }
  }
}

async function deleteStravaConnectionsForUser(
  client: ServiceClient,
  userId: string,
) {
  const { data, error } = await client
    .from("strava_connections")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}

async function deleteWebhookEvents(
  client: ServiceClient,
  athleteIds: number[],
  stravaActivityIds: number[],
) {
  let deleted = false;

  if (athleteIds.length > 0) {
    const { error } = await client
      .from("webhook_events")
      .delete()
      .in("owner_id", athleteIds);

    if (error) {
      throw error;
    }

    deleted = true;
  }

  if (stravaActivityIds.length > 0) {
    const { error } = await client
      .from("webhook_events")
      .delete()
      .eq("object_type", "activity")
      .in("object_id", stravaActivityIds);

    if (error) {
      throw error;
    }

    deleted = true;
  }

  return deleted;
}

async function redactAuditLogsForActivities(
  client: ServiceClient,
  activityIds: string[],
  erasedAt: Date,
) {
  if (activityIds.length === 0) {
    return false;
  }

  const redactedSnapshot = {
    redacted: true,
    redacted_at: erasedAt.toISOString(),
    reason: "Strava detail data erased for this activity.",
  } satisfies Json;
  const { error } = await client
    .from("audit_log")
    .update({
      after: redactedSnapshot,
      before: redactedSnapshot,
    })
    .eq("entity_type", "activity")
    .in("entity_id", activityIds);

  if (error) {
    throw error;
  }

  return true;
}
