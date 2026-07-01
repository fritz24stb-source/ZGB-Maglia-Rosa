import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  isScoreResultScored,
  scoreActivity,
  toActivityScoreUpdate,
} from "@/lib/scoring";
import type { ScorableActivity, ScoringRuleRow } from "@/lib/scoring";
import {
  fetchStravaActivity,
  getStravaActivityAthleteId,
  getStravaActivityLocalDate,
  mapStravaActivityToActivityWrite,
  type StravaDetailedActivity,
} from "@/lib/strava/activity";
import { getValidStravaAccessToken } from "@/lib/strava/token";
import {
  isActivityDeleteEvent,
  isActivityFetchEvent,
  isStravaDeauthorizationEvent,
  parseStravaWebhookEvent,
  webhookEventTimeToIso,
  type StravaWebhookEvent,
} from "@/lib/strava/webhook";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

type FetchLike = typeof fetch;
type ServiceClient = SupabaseClient<Database>;
type ActivityWrite = Database["public"]["Tables"]["activities"]["Insert"] &
  Database["public"]["Tables"]["activities"]["Update"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];
type StravaConnectionRow =
  Database["public"]["Tables"]["strava_connections"]["Row"];
type WebhookEventRow = Database["public"]["Tables"]["webhook_events"]["Row"];
type ProcessingStatus = WebhookEventRow["processing_status"];

type ProcessClaimResult = {
  status: Extract<ProcessingStatus, "processed" | "ignored">;
  reason?: string;
  activityId?: string;
};

type QueueStatus = "queued" | "duplicate";

export type ProcessStravaWebhookInput = {
  payload: unknown;
  client?: ServiceClient;
  fetchImpl?: FetchLike;
  now?: Date;
};

export type ProcessStravaWebhookResult = {
  status: ProcessingStatus | "duplicate";
  eventId: string;
  reason?: string;
  activityId?: string;
};

export type QueueStravaWebhookResult = {
  status: QueueStatus;
  eventId: string;
  reason?: string;
};

export type ProcessQueuedStravaWebhookInput = {
  eventId: string;
  client?: ServiceClient;
  fetchImpl?: FetchLike;
  now?: Date;
};

export type ProcessPendingStravaWebhookInput = {
  client?: ServiceClient;
  fetchImpl?: FetchLike;
  limit?: number;
  now?: Date;
};

export type ProcessPendingStravaWebhookSummary = {
  failed: number;
  ignored: number;
  processed: number;
  duplicates: number;
  errors: Array<{
    eventId: string;
    message: string;
  }>;
};

const DEFAULT_PENDING_WEBHOOK_LIMIT = 25;

export async function processStravaWebhookPayload({
  payload,
  client = createSupabaseServiceRoleClient(),
  fetchImpl = fetch,
  now = new Date(),
}: ProcessStravaWebhookInput): Promise<ProcessStravaWebhookResult> {
  const queuedEvent = await queueStravaWebhookPayload({ payload, client });

  if (queuedEvent.status === "duplicate") {
    return {
      status: "duplicate",
      eventId: queuedEvent.eventId,
      reason: queuedEvent.reason,
    };
  }

  return processQueuedStravaWebhookEvent({
    eventId: queuedEvent.eventId,
    client,
    fetchImpl,
    now,
  });
}

export async function queueStravaWebhookPayload({
  payload,
  client = createSupabaseServiceRoleClient(),
}: Pick<
  ProcessStravaWebhookInput,
  "payload" | "client"
>): Promise<QueueStravaWebhookResult> {
  const event = parseStravaWebhookEvent(payload);
  const storedEvent = await insertOrFetchWebhookEvent(client, event, payload);

  if (storedEvent.processing_status === "pending") {
    return {
      status: "queued",
      eventId: storedEvent.id,
    };
  }

  if (storedEvent.processing_status === "failed") {
    return {
      status: "queued",
      eventId: storedEvent.id,
      reason: "Previously failed event queued for retry.",
    };
  }

  return {
    status: "duplicate",
    eventId: storedEvent.id,
    reason: `Event is already ${storedEvent.processing_status}.`,
  };
}

export async function processQueuedStravaWebhookEvent({
  eventId,
  client = createSupabaseServiceRoleClient(),
  fetchImpl = fetch,
  now = new Date(),
}: ProcessQueuedStravaWebhookInput): Promise<ProcessStravaWebhookResult> {
  const storedEvent = await findWebhookEventById(client, eventId);
  const claimedEvent = await claimWebhookEvent(client, storedEvent.id);

  if (!claimedEvent) {
    return {
      status: "duplicate",
      eventId: storedEvent.id,
      reason: `Event is already ${storedEvent.processing_status}.`,
    };
  }

  try {
    const event = parseStravaWebhookEvent(claimedEvent.raw_payload);
    const result = await processClaimedWebhookEvent(
      client,
      event,
      fetchImpl,
      now,
    );

    await finishWebhookEvent(client, claimedEvent.id, {
      status: result.status,
      reason: result.reason,
      processedAt: now,
    });

    return {
      ...result,
      eventId: claimedEvent.id,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    await finishWebhookEvent(client, claimedEvent.id, {
      status: "failed",
      reason: message,
      processedAt: now,
    });

    return {
      status: "failed",
      eventId: claimedEvent.id,
      reason: message,
    };
  }
}

export async function processPendingStravaWebhookEvents({
  client = createSupabaseServiceRoleClient(),
  fetchImpl = fetch,
  limit = DEFAULT_PENDING_WEBHOOK_LIMIT,
  now = new Date(),
}: ProcessPendingStravaWebhookInput = {}): Promise<ProcessPendingStravaWebhookSummary> {
  const { data, error } = await client
    .from("webhook_events")
    .select("id")
    .in("processing_status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const summary: ProcessPendingStravaWebhookSummary = {
    failed: 0,
    ignored: 0,
    processed: 0,
    duplicates: 0,
    errors: [],
  };

  for (const event of data ?? []) {
    try {
      const result = await processQueuedStravaWebhookEvent({
        eventId: event.id,
        client,
        fetchImpl,
        now,
      });

      if (result.status === "processed") {
        summary.processed += 1;
      } else if (result.status === "ignored") {
        summary.ignored += 1;
      } else if (result.status === "failed") {
        summary.failed += 1;
        summary.errors.push({
          eventId: event.id,
          message: result.reason ?? "Webhook event processing failed.",
        });
      } else {
        summary.duplicates += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        eventId: event.id,
        message: getErrorMessage(error),
      });
    }
  }

  return summary;
}

async function processClaimedWebhookEvent(
  client: ServiceClient,
  event: StravaWebhookEvent,
  fetchImpl: FetchLike,
  now: Date,
): Promise<ProcessClaimResult> {
  if (isStravaDeauthorizationEvent(event)) {
    return revokeStravaConnectionFromWebhook(client, event.owner_id);
  }

  if (isActivityDeleteEvent(event)) {
    return markStravaActivityDeleted(client, event.object_id, now);
  }

  if (isActivityFetchEvent(event)) {
    return fetchAndUpsertStravaActivity(client, event, fetchImpl, now);
  }

  return {
    status: "ignored",
    reason: `Unsupported Strava webhook event: ${event.object_type}/${event.aspect_type}.`,
  };
}

async function fetchAndUpsertStravaActivity(
  client: ServiceClient,
  event: StravaWebhookEvent,
  fetchImpl: FetchLike,
  now: Date,
): Promise<ProcessClaimResult> {
  const connection = await findStravaConnectionByAthleteId(
    client,
    event.owner_id,
  );

  if (!connection) {
    return {
      status: "ignored",
      reason: `No local Strava connection found for athlete ${event.owner_id}.`,
    };
  }

  if (connection.revoked) {
    return {
      status: "ignored",
      reason: `Strava connection for athlete ${event.owner_id} is revoked.`,
    };
  }

  const accessToken = await getValidStravaAccessToken(connection);
  const stravaActivity = await fetchStravaActivity(
    event.object_id,
    accessToken,
    fetchImpl,
  );
  const activityAthleteId = getStravaActivityAthleteId(stravaActivity);

  if (activityAthleteId !== null && activityAthleteId !== event.owner_id) {
    throw new Error(
      `Fetched Strava activity belongs to athlete ${activityAthleteId}, expected ${event.owner_id}.`,
    );
  }

  const season = await findSeasonForActivity(client, stravaActivity);

  if (!season) {
    return {
      status: "ignored",
      reason: `No season found for Strava activity ${event.object_id}.`,
    };
  }

  const activityWrite = mapStravaActivityToActivityWrite({
    activity: stravaActivity,
    userId: connection.user_id,
    seasonId: season.id,
  });
  const existingActivity = await findExistingStravaActivityForScoring(
    client,
    event.object_id,
  );
  const rules = await fetchScoringRules(client, season.id);
  const score = scoreActivity(
    toScorableStravaActivity(
      activityWrite,
      existingActivity?.scoring_override_rule_id ?? null,
    ),
    rules,
    {
      scoredAt: now,
    },
  );
  const isScored = isScoreResultScored(score);

  const activity = await upsertStravaActivity(client, {
    ...activityWrite,
    ...toActivityScoreUpdate(score),
  });

  return {
    status: "processed",
    activityId: activity.id,
    reason: isScored
      ? undefined
      : `Strava activity ${event.object_id} stored without scoring rule.`,
  };
}

async function revokeStravaConnectionFromWebhook(
  client: ServiceClient,
  athleteId: number,
): Promise<ProcessClaimResult> {
  const connection = await findStravaConnectionByAthleteId(client, athleteId);

  if (!connection) {
    return {
      status: "ignored",
      reason: `No local Strava connection found for revoked athlete ${athleteId}.`,
    };
  }

  const { error } = await client
    .from("strava_connections")
    .update({
      access_token: null,
      revoked: true,
    })
    .eq("id", connection.id);

  if (error) {
    throw error;
  }

  return {
    status: "processed",
    reason: `Strava connection for athlete ${athleteId} marked revoked.`,
  };
}

async function markStravaActivityDeleted(
  client: ServiceClient,
  stravaActivityId: number,
  now: Date,
): Promise<ProcessClaimResult> {
  const { data, error } = await client
    .from("activities")
    .update({
      status: "deleted",
      points: 0,
      awarded_points: 0,
      scoring_override_rule_id: null,
      scoring_reason: "Strava delete webhook processed.",
      scored_at: now.toISOString(),
    })
    .eq("strava_activity_id", stravaActivityId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      status: "ignored",
      reason: `No local activity found for deleted Strava activity ${stravaActivityId}.`,
    };
  }

  return {
    status: "processed",
    activityId: data.id,
  };
}

async function fetchScoringRules(client: ServiceClient, seasonId: string) {
  const { data: rules, error: rulesError } = await client
    .from("scoring_rules")
    .select("*")
    .eq("is_active", true)
    .or(`season_id.is.null,season_id.eq.${seasonId}`);

  if (rulesError) {
    throw rulesError;
  }

  return (rules ?? []) as ScoringRuleRow[];
}

async function findExistingStravaActivityForScoring(
  client: ServiceClient,
  stravaActivityId: number,
) {
  const { data, error } = await client
    .from("activities")
    .select("id, scoring_override_rule_id")
    .eq("source", "strava")
    .eq("strava_activity_id", stravaActivityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Pick<
    Database["public"]["Tables"]["activities"]["Row"],
    "id" | "scoring_override_rule_id"
  > | null;
}

function toScorableStravaActivity(
  activityWrite: ActivityWrite,
  scoringOverrideRuleId: string | null,
) {
  const activityStartedAt = activityWrite.activity_started_at;
  const activityName = activityWrite.activity_name;
  const seasonId = activityWrite.season_id;
  const stravaActivityId = activityWrite.strava_activity_id;

  if (!activityStartedAt || !activityName || !seasonId || !stravaActivityId) {
    throw new Error("Cannot score incomplete Strava activity payload.");
  }

  return {
    id: `strava-${stravaActivityId}`,
    season_id: seasonId,
    source: "strava",
    activity_name: activityName,
    sport_type: activityWrite.sport_type ?? null,
    distance_m: activityWrite.distance_m ?? null,
    activity_started_at: activityStartedAt,
    activity_started_local_at: activityWrite.activity_started_local_at ?? null,
    status: "active",
    manually_entered: false,
    scoring_override_rule_id: scoringOverrideRuleId,
  } satisfies ScorableActivity;
}

async function upsertStravaActivity(
  client: ServiceClient,
  activityWrite: ActivityWrite,
) {
  const stravaActivityId = activityWrite.strava_activity_id;

  if (stravaActivityId === undefined || stravaActivityId === null) {
    throw new Error("Cannot upsert Strava activity without Strava id.");
  }

  const updatedActivity = await updateStravaActivity(
    client,
    stravaActivityId,
    activityWrite,
  );

  if (updatedActivity) {
    return updatedActivity;
  }

  const { data: insertedActivity, error: insertError } = await client
    .from("activities")
    .insert(activityWrite)
    .select("*")
    .single();

  if (!insertError) {
    return insertedActivity;
  }

  if (!isUniqueViolation(insertError)) {
    throw insertError;
  }

  const retriedActivity = await updateStravaActivity(
    client,
    stravaActivityId,
    activityWrite,
  );

  if (!retriedActivity) {
    throw insertError;
  }

  return retriedActivity;
}

async function updateStravaActivity(
  client: ServiceClient,
  stravaActivityId: number,
  activityWrite: ActivityWrite,
) {
  const { data, error } = await client
    .from("activities")
    .update(activityWrite)
    .eq("strava_activity_id", stravaActivityId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findSeasonForActivity(
  client: ServiceClient,
  activity: StravaDetailedActivity,
) {
  const activityDate = getStravaActivityLocalDate(activity);

  if (!activityDate) {
    throw new Error("Cannot select season without activity start date.");
  }

  const { data, error } = await client
    .from("seasons")
    .select("*")
    .lte("starts_on", activityDate)
    .gte("ends_on", activityDate)
    .order("is_active", { ascending: false })
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as SeasonRow | null;
}

async function findStravaConnectionByAthleteId(
  client: ServiceClient,
  athleteId: number,
) {
  const { data, error } = await client
    .from("strava_connections")
    .select("*")
    .eq("strava_athlete_id", athleteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as StravaConnectionRow | null;
}

async function findWebhookEventById(client: ServiceClient, eventId: string) {
  const { data, error } = await client
    .from("webhook_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) {
    throw error;
  }

  return data as WebhookEventRow;
}

async function insertOrFetchWebhookEvent(
  client: ServiceClient,
  event: StravaWebhookEvent,
  rawPayload: unknown,
) {
  const eventTime = webhookEventTimeToIso(event.event_time);
  const eventInsert = {
    object_type: event.object_type,
    object_id: event.object_id,
    aspect_type: event.aspect_type,
    owner_id: event.owner_id,
    event_time: eventTime,
    raw_payload: rawPayload as Json,
    processing_status: "pending" as const,
    processing_error: null,
  };
  const { data, error } = await client
    .from("webhook_events")
    .insert(eventInsert)
    .select("*")
    .single();

  if (!error) {
    return data;
  }

  if (!isUniqueViolation(error)) {
    throw error;
  }

  const { data: existingEvent, error: selectError } = await client
    .from("webhook_events")
    .select("*")
    .eq("object_type", event.object_type)
    .eq("object_id", event.object_id)
    .eq("aspect_type", event.aspect_type)
    .eq("event_time", eventTime)
    .single();

  if (selectError) {
    throw selectError;
  }

  return existingEvent;
}

async function claimWebhookEvent(client: ServiceClient, eventId: string) {
  const { data, error } = await client
    .from("webhook_events")
    .update({
      processing_status: "processing",
      processing_error: null,
      processed_at: null,
    })
    .eq("id", eventId)
    .in("processing_status", ["pending", "failed"])
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as WebhookEventRow | null;
}

async function finishWebhookEvent(
  client: ServiceClient,
  eventId: string,
  {
    status,
    reason,
    processedAt,
  }: {
    status: ProcessingStatus;
    reason?: string;
    processedAt: Date;
  },
) {
  const { error } = await client
    .from("webhook_events")
    .update({
      processing_status: status,
      processed_at: processedAt.toISOString(),
      processing_error: reason ?? null,
    })
    .eq("id", eventId);

  if (error) {
    throw error;
  }
}

function isUniqueViolation(error: PostgrestError) {
  return error.code === "23505";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
