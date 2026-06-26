import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreActivity, toActivityScoreUpdate } from "@/lib/scoring/engine";
import type {
  ActivityScoreUpdate,
  ScorableActivity,
  ScoreResult,
  ScoringRuleRow,
} from "@/lib/scoring/types";
import type { Database } from "@/types/database";

export type RescoreActivitiesInput = {
  activities: ScorableActivity[];
  rules: ScoringRuleRow[];
  scoredAt?: Date;
  stopOnError?: boolean;
  updateActivity: (
    activity: ScorableActivity,
    score: ScoreResult,
    update: ActivityScoreUpdate,
  ) => Promise<void> | void;
};

export type RescoreSeasonInput = {
  client: SupabaseClient<Database>;
  seasonId: string;
  activityIds?: string[];
  includeInactive?: boolean;
  scoredAt?: Date;
  stopOnError?: boolean;
};

export type RescoreActivityError = {
  activityId: string;
  message: string;
};

export type RescoreSummary = {
  total: number;
  updated: number;
  matched: number;
  unmatched: number;
  failed: number;
  errors: RescoreActivityError[];
};

export async function rescoreActivities({
  activities,
  rules,
  scoredAt,
  stopOnError = false,
  updateActivity,
}: RescoreActivitiesInput): Promise<RescoreSummary> {
  const summary: RescoreSummary = {
    total: activities.length,
    updated: 0,
    matched: 0,
    unmatched: 0,
    failed: 0,
    errors: [],
  };

  for (const activity of activities) {
    const score = scoreActivity(activity, rules, { scoredAt });
    const update = toActivityScoreUpdate(score);

    try {
      await updateActivity(activity, score, update);
      summary.updated += 1;

      if (score.matchedRuleId) {
        summary.matched += 1;
      } else {
        summary.unmatched += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        activityId: activity.id,
        message: getErrorMessage(error),
      });

      if (stopOnError) {
        throw error;
      }
    }
  }

  return summary;
}

export async function rescoreSeasonActivities({
  client,
  seasonId,
  activityIds,
  includeInactive = false,
  scoredAt,
  stopOnError,
}: RescoreSeasonInput): Promise<RescoreSummary> {
  if (!seasonId.trim()) {
    throw new Error("seasonId is required for re-scoring.");
  }

  if (activityIds?.length === 0) {
    return {
      total: 0,
      updated: 0,
      matched: 0,
      unmatched: 0,
      failed: 0,
      errors: [],
    };
  }

  const rules = await fetchScoringRules(client, seasonId);
  const activities = await fetchActivities(client, {
    seasonId,
    activityIds,
    includeInactive,
  });

  return rescoreActivities({
    activities,
    rules,
    scoredAt,
    stopOnError,
    updateActivity: async (activity, _score, update) => {
      const { error } = await client
        .from("activities")
        .update(update)
        .eq("id", activity.id);

      if (error) {
        throw error;
      }
    },
  });
}

async function fetchScoringRules(
  client: SupabaseClient<Database>,
  seasonId: string,
) {
  const { data, error } = await client
    .from("scoring_rules")
    .select("*")
    .eq("is_active", true)
    .or(`season_id.is.null,season_id.eq.${seasonId}`);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchActivities(
  client: SupabaseClient<Database>,
  {
    seasonId,
    activityIds,
    includeInactive,
  }: Pick<RescoreSeasonInput, "seasonId" | "activityIds" | "includeInactive">,
) {
  let query = client.from("activities").select("*").eq("season_id", seasonId);

  if (!includeInactive) {
    query = query.eq("status", "active");
  }

  if (activityIds?.length) {
    query = query.in("id", activityIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
