import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isScoreResultScored,
  scoreActivity,
  toActivityScoreUpdate,
} from "@/lib/scoring";
import type { ScorableActivity, ScoringRuleRow } from "@/lib/scoring";
import {
  getStravaActivityAthleteId,
  getStravaActivityLocalDate,
  mapStravaActivityToActivityWrite,
  type StravaActivitySummary,
} from "@/lib/strava/activity";
import {
  fetchStravaActivitySummariesForRange,
  type SyncCompletionStatus,
} from "@/lib/strava/resync-pages";
import { getValidStravaAccessToken } from "@/lib/strava/token";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ActivityWrite = Database["public"]["Tables"]["activities"]["Insert"] &
  Database["public"]["Tables"]["activities"]["Update"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];
type StravaConnectionRow =
  Database["public"]["Tables"]["strava_connections"]["Row"];

type FetchLike = typeof fetch;
type SyncCaches = {
  rulesBySeasonId: Map<string, ScoringRuleRow[]>;
};

export type AdminSyncError = {
  message: string;
  scope: string;
};

export type AdminSyncSummary = {
  activitiesFetched: number;
  apiRequests: number;
  completionStatus: SyncCompletionStatus;
  failed: number;
  scored: number;
  skipped: number;
  synced: number;
  users: number;
  errors: AdminSyncError[];
};

export type SyncUserInput = {
  client: ServiceClient;
  fetchImpl?: FetchLike;
  maxPages?: number;
  now?: Date;
  perPage?: number;
  seasonId?: string | null;
  userId: string;
};

export type SyncActiveUsersInput = Omit<SyncUserInput, "userId">;

const DEFAULT_MAX_PAGES = 3;
const DEFAULT_PER_PAGE = 100;

export async function syncStravaActivitiesForUser({
  client,
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
  now = new Date(),
  perPage = DEFAULT_PER_PAGE,
  seasonId,
  userId,
}: SyncUserInput): Promise<AdminSyncSummary> {
  const summary = emptySummary();
  summary.users = 1;
  const caches = createSyncCaches();

  const [connection, seasons] = await Promise.all([
    findConnectionForUser(client, userId),
    findSeasonsForSync(client, seasonId),
  ]);

  if (!connection) {
    summary.skipped += 1;
    summary.errors.push({
      scope: `user:${userId}`,
      message: "Keine Strava-Verbindung vorhanden.",
    });
    return summary;
  }

  if (connection.revoked) {
    summary.skipped += 1;
    summary.errors.push({
      scope: `user:${userId}`,
      message: "Strava-Verbindung ist widerrufen.",
    });
    return summary;
  }

  if (seasons.length === 0) {
    summary.skipped += 1;
    summary.completionStatus = "no_active_season";
    summary.errors.push({
      scope: `user:${userId}`,
      message: "Keine Saison für den Strava-Resync konfiguriert.",
    });
    return summary;
  }

  const accessToken = await getValidStravaAccessToken(connection);
  const seenActivityIds = new Set<number>();

  for (const season of seasons) {
    const range = seasonToStravaRange(season);
    const fetchedRange = await fetchStravaActivitySummariesForRange({
      accessToken,
      after: range.after,
      before: range.before,
      fetchImpl,
      maxPages,
      perPage,
    });

    summary.apiRequests += fetchedRange.apiRequests;
    summary.completionStatus = mergeCompletionStatus(
      summary.completionStatus,
      fetchedRange.completionStatus,
    );

    if (fetchedRange.rateLimitError) {
      summary.errors.push({
        scope: `season:${season.id}`,
        message: fetchedRange.rateLimitError,
      });
    }

    for (const activity of fetchedRange.activities) {
      if (!Number.isFinite(activity.id)) {
        summary.skipped += 1;
        continue;
      }

      if (seenActivityIds.has(activity.id)) {
        summary.skipped += 1;
        continue;
      }

      seenActivityIds.add(activity.id);
      summary.activitiesFetched += 1;

      try {
        const result = await syncSummaryActivity({
          activity,
          caches,
          client,
          connection,
          now,
          requestedSeason: season,
        });

        if (result === "scored") {
          summary.synced += 1;
          summary.scored += 1;
        } else if (result === "synced") {
          summary.synced += 1;
        } else {
          summary.skipped += 1;
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          scope: `activity:${activity.id}`,
          message: getErrorMessage(error),
        });
      }
    }

    if (fetchedRange.completionStatus === "partial_rate_budget") {
      break;
    }
  }

  return summary;
}

export async function syncStravaActivitiesForActiveUsers({
  client,
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
  now = new Date(),
  perPage = DEFAULT_PER_PAGE,
  seasonId,
}: SyncActiveUsersInput): Promise<AdminSyncSummary> {
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    throw error;
  }

  const aggregate = emptySummary();

  for (const profile of data ?? []) {
    try {
      const userSummary = await syncStravaActivitiesForUser({
        client,
        fetchImpl,
        maxPages,
        now,
        perPage,
        seasonId,
        userId: profile.id,
      });

      mergeSummary(aggregate, userSummary);

      if (userSummary.completionStatus === "partial_rate_budget") {
        break;
      }
    } catch (error) {
      aggregate.users += 1;
      aggregate.failed += 1;
      aggregate.errors.push({
        scope: `user:${profile.id}`,
        message: getErrorMessage(error),
      });
    }
  }

  return aggregate;
}

function emptySummary(): AdminSyncSummary {
  return {
    activitiesFetched: 0,
    apiRequests: 0,
    completionStatus: "completed",
    failed: 0,
    scored: 0,
    skipped: 0,
    synced: 0,
    users: 0,
    errors: [],
  };
}

function createSyncCaches(): SyncCaches {
  return {
    rulesBySeasonId: new Map(),
  };
}

function mergeSummary(target: AdminSyncSummary, source: AdminSyncSummary) {
  target.activitiesFetched += source.activitiesFetched;
  target.apiRequests += source.apiRequests;
  target.completionStatus = mergeCompletionStatus(
    target.completionStatus,
    source.completionStatus,
  );
  target.failed += source.failed;
  target.scored += source.scored;
  target.skipped += source.skipped;
  target.synced += source.synced;
  target.users += source.users;
  target.errors.push(...source.errors);
}

function mergeCompletionStatus(
  current: SyncCompletionStatus,
  next: SyncCompletionStatus,
) {
  const priority: Record<SyncCompletionStatus, number> = {
    completed: 0,
    no_active_season: 1,
    partial_page_limit: 2,
    partial_rate_budget: 3,
  };

  return priority[next] > priority[current] ? next : current;
}

async function syncSummaryActivity(input: {
  activity: StravaActivitySummary;
  caches: SyncCaches;
  client: ServiceClient;
  connection: StravaConnectionRow;
  now: Date;
  requestedSeason: SeasonRow;
}) {
  const athleteId = getStravaActivityAthleteId(input.activity);

  if (athleteId !== null && athleteId !== input.connection.strava_athlete_id) {
    throw new Error(
      `Strava-Aktivität gehört zu Athlete ${athleteId}, erwartet ${input.connection.strava_athlete_id}.`,
    );
  }

  const activityDate = getStravaActivityLocalDate(input.activity);

  if (!activityDate) {
    throw new Error("Aktivität hat kein verwertbares Startdatum.");
  }

  const season = seasonForActivityDate(input.requestedSeason, activityDate);

  if (!season) {
    return "skipped";
  }

  const activityWrite = mapStravaActivityToActivityWrite({
    activity: input.activity,
    seasonId: season.id,
    userId: input.connection.user_id,
  });
  const existingActivity = await findExistingStravaActivityForScoring(
    input.client,
    input.activity.id,
  );
  const rules = await fetchScoringRules(
    input.client,
    season.id,
    input.caches.rulesBySeasonId,
  );
  const score = scoreActivity(
    toScorableStravaActivity(
      activityWrite,
      existingActivity?.scoring_override_rule_id ?? null,
    ),
    rules,
    {
      scoredAt: input.now,
    },
  );
  const isScored = isScoreResultScored(score);

  await upsertStravaActivity(input.client, {
    ...activityWrite,
    ...toActivityScoreUpdate(score),
  });

  return isScored ? "scored" : "synced";
}

async function findConnectionForUser(client: ServiceClient, userId: string) {
  const { data, error } = await client
    .from("strava_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as StravaConnectionRow | null;
}

async function findSeasonById(client: ServiceClient, seasonId: string) {
  const { data, error } = await client
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Saison nicht gefunden.");
  }

  return data as SeasonRow;
}

async function findSeasonsForSync(
  client: ServiceClient,
  seasonId: string | null | undefined,
) {
  if (seasonId) {
    return [await findSeasonById(client, seasonId)];
  }

  const { data, error } = await client
    .from("seasons")
    .select("*")
    .order("is_active", { ascending: false })
    .order("starts_on", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SeasonRow[];
}

async function upsertStravaActivity(
  client: ServiceClient,
  activityWrite: ActivityWrite,
) {
  const stravaActivityId = activityWrite.strava_activity_id;

  if (stravaActivityId === undefined || stravaActivityId === null) {
    throw new Error(
      "Strava-Aktivität ohne Strava-ID kann nicht synchronisiert werden.",
    );
  }

  const updatedActivity = await updateStravaActivity(
    client,
    stravaActivityId,
    activityWrite,
  );

  if (updatedActivity) {
    return updatedActivity;
  }

  const { data: insertedActivity, error } = await client
    .from("activities")
    .insert(activityWrite)
    .select("*")
    .single();

  if (error) {
    if (error.code !== "23505") {
      throw error;
    }

    const retriedActivity = await updateStravaActivity(
      client,
      stravaActivityId,
      activityWrite,
    );

    if (!retriedActivity) {
      throw error;
    }

    return retriedActivity;
  }

  return insertedActivity;
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

  return data as ActivityRow | null;
}

async function fetchScoringRules(
  client: ServiceClient,
  seasonId: string,
  cache?: Map<string, ScoringRuleRow[]>,
) {
  const cachedRules = cache?.get(seasonId);

  if (cachedRules) {
    return cachedRules;
  }

  const { data: rules, error: rulesError } = await client
    .from("scoring_rules")
    .select("*")
    .eq("is_active", true)
    .or(`season_id.is.null,season_id.eq.${seasonId}`);

  if (rulesError) {
    throw rulesError;
  }

  const scoringRules = (rules ?? []) as ScoringRuleRow[];
  cache?.set(seasonId, scoringRules);

  return scoringRules;
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

  return data as Pick<ActivityRow, "id" | "scoring_override_rule_id"> | null;
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

function seasonToStravaRange(season: SeasonRow) {
  const after = Math.floor(
    new Date(`${season.starts_on}T00:00:00.000Z`).getTime() / 1000,
  );
  const before = Math.floor(
    (new Date(`${season.ends_on}T00:00:00.000Z`).getTime() +
      24 * 60 * 60 * 1000) /
      1000,
  );

  return { after, before };
}

function seasonForActivityDate(season: SeasonRow, activityDate: string) {
  return activityDate >= season.starts_on && activityDate <= season.ends_on
    ? season
    : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
