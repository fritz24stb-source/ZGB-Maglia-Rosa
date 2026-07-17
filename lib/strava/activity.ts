import {
  formatStravaRateLimitMessage,
  isStravaRateLimitStatus,
} from "@/lib/strava/errors";
import { parseStravaRateLimitHeaders } from "@/lib/strava/rate-limit";
import type { Database } from "@/types/database";

export const STRAVA_API_BASE_URL = "https://www.strava.com/api/v3";

type FetchLike = typeof fetch;
type ActivityWrite = Database["public"]["Tables"]["activities"]["Insert"] &
  Database["public"]["Tables"]["activities"]["Update"];

export type StravaDetailedActivity = {
  id: number;
  name?: string | null;
  sport_type?: string | null;
  type?: string | null;
  distance?: number | null;
  start_date?: string | null;
  start_date_local?: string | null;
  created_at?: string | null;
  athlete?: {
    id?: number | null;
  } | null;
};

export type StravaActivitySummary = Pick<
  StravaDetailedActivity,
  | "athlete"
  | "distance"
  | "id"
  | "name"
  | "sport_type"
  | "start_date"
  | "start_date_local"
  | "type"
>;

export type ActivityMappingInput = {
  activity: StravaDetailedActivity;
  userId: string;
  seasonId: string;
};

export class StravaActivityFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "StravaActivityFetchError";
  }
}

export async function fetchStravaActivity(
  activityId: number,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
) {
  const response = await fetchImpl(
    `${STRAVA_API_BASE_URL}/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw await buildStravaActivityFetchError(
      `Strava activity fetch failed for ${activityId}.`,
      response,
    );
  }

  const activity = (await response.json()) as StravaDetailedActivity;

  if (!Number.isFinite(activity.id)) {
    throw new Error("Strava activity response did not include a valid id.");
  }

  return activity;
}

export async function fetchStravaAthleteActivities(
  input: {
    accessToken: string;
    after?: number;
    before?: number;
    page?: number;
    perPage?: number;
  },
  fetchImpl: FetchLike = fetch,
) {
  const url = new URL(`${STRAVA_API_BASE_URL}/athlete/activities`);

  if (input.after !== undefined) {
    url.searchParams.set("after", String(input.after));
  }

  if (input.before !== undefined) {
    url.searchParams.set("before", String(input.before));
  }

  url.searchParams.set("page", String(input.page ?? 1));
  url.searchParams.set("per_page", String(input.perPage ?? 100));

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
  });

  if (!response.ok) {
    throw await buildStravaActivityFetchError(
      "Strava activity list fetch failed.",
      response,
    );
  }

  return {
    activities: (await response.json()) as StravaActivitySummary[],
    rateLimit: parseStravaRateLimitHeaders(response.headers),
  };
}

export function mapStravaActivityToActivityWrite({
  activity,
  userId,
  seasonId,
}: ActivityMappingInput): ActivityWrite {
  const stravaActivityId = normalizeFiniteNumber(activity.id);
  const activityStartedAt = normalizeTimestamp(activity.start_date);

  if (stravaActivityId === null) {
    throw new Error("Cannot store Strava activity without activity id.");
  }

  if (!activityStartedAt) {
    throw new Error("Cannot store Strava activity without start_date.");
  }

  const uploadedOrCreatedAt = normalizeTimestamp(activity.created_at);

  return {
    user_id: userId,
    season_id: seasonId,
    strava_activity_id: stravaActivityId,
    source: "strava",
    activity_name: normalizeActivityName(activity.name, stravaActivityId),
    sport_type: normalizeOptionalText(activity.sport_type ?? activity.type),
    distance_m: normalizeFiniteNumber(activity.distance),
    activity_started_at: activityStartedAt,
    activity_started_local_at: normalizeTimestamp(activity.start_date_local),
    ...(uploadedOrCreatedAt
      ? { uploaded_or_created_at: uploadedOrCreatedAt }
      : {}),
    status: "active",
    manually_entered: false,
    manual_comment: null,
    manual_entry_key: null,
    strava_url: `https://www.strava.com/activities/${stravaActivityId}`,
  };
}

export function getStravaActivityLocalDate(activity: StravaDetailedActivity) {
  const timestamp = activity.start_date_local ?? activity.start_date;

  if (!timestamp) {
    return null;
  }

  const datePart = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp)?.[1];

  if (datePart) {
    return datePart;
  }

  return normalizeTimestamp(timestamp)?.slice(0, 10) ?? null;
}

export function getStravaActivityAthleteId(activity: StravaDetailedActivity) {
  return normalizeFiniteNumber(activity.athlete?.id);
}

function normalizeActivityName(name: string | null | undefined, id: number) {
  const normalizedName = name?.trim();

  return normalizedName || `Strava Aktivität ${id}`;
}

async function buildStravaActivityFetchError(
  message: string,
  response: Response,
) {
  const responseBody = await response.text().catch(() => "");
  const safeMessage = isStravaRateLimitStatus(response.status)
    ? formatStravaRateLimitMessage(response.headers.get("retry-after"))
    : message;

  return new StravaActivityFetchError(
    safeMessage,
    response.status,
    responseBody,
  );
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue || null;
}

function normalizeFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTimestamp(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  const valueWithTimezone = hasTimezone(normalizedValue)
    ? normalizedValue
    : `${normalizedValue}Z`;
  const parsedDate = new Date(valueWithTimezone);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function hasTimezone(value: string) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
}
