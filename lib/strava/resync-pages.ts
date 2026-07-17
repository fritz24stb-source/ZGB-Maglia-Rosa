import {
  fetchStravaAthleteActivities,
  type StravaActivitySummary,
} from "@/lib/strava/activity";
import { isStravaRateLimitError } from "@/lib/strava/errors";
import { hasStravaReadBudget } from "@/lib/strava/rate-limit";

type FetchLike = typeof fetch;

export type SyncCompletionStatus =
  | "completed"
  | "partial_rate_budget"
  | "partial_page_limit"
  | "no_active_season";

export type FetchStravaSummaryRangeResult = {
  activities: StravaActivitySummary[];
  apiRequests: number;
  completionStatus: Exclude<SyncCompletionStatus, "no_active_season">;
  rateLimitError: string | null;
};

export async function fetchStravaActivitySummariesForRange(input: {
  accessToken: string;
  after: number;
  before: number;
  fetchImpl?: FetchLike;
  maxPages: number;
  perPage: number;
}): Promise<FetchStravaSummaryRangeResult> {
  const activities: StravaActivitySummary[] = [];
  let apiRequests = 0;

  for (let page = 1; page <= input.maxPages; page += 1) {
    try {
      apiRequests += 1;
      const result = await fetchStravaAthleteActivities(
        {
          accessToken: input.accessToken,
          after: input.after,
          before: input.before,
          page,
          perPage: input.perPage,
        },
        input.fetchImpl,
      );

      activities.push(...result.activities);

      if (!result.rateLimit || !hasStravaReadBudget(result.rateLimit)) {
        return {
          activities,
          apiRequests,
          completionStatus: "partial_rate_budget",
          rateLimitError: result.rateLimit
            ? "Strava API-Reserve erreicht. Resync wurde vorzeitig beendet."
            : "Strava Rate-Limit-Header fehlen. Resync wurde vorsorglich beendet.",
        };
      }

      if (result.activities.length < input.perPage) {
        return {
          activities,
          apiRequests,
          completionStatus: "completed",
          rateLimitError: null,
        };
      }
    } catch (error) {
      if (!isStravaRateLimitError(error)) {
        throw error;
      }

      return {
        activities,
        apiRequests,
        completionStatus: "partial_rate_budget",
        rateLimitError: getErrorMessage(error),
      };
    }
  }

  return {
    activities,
    apiRequests,
    completionStatus: "partial_page_limit",
    rateLimitError: null,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
