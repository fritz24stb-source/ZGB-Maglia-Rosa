import type { Database } from "@/types/database";

type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];
type StravaConnectionUpdate =
  Database["public"]["Tables"]["strava_connections"]["Update"];

export const ERASED_STRAVA_ACTIVITY_NAME = "Gelöschte Aktivität";

export function buildStravaConnectionDisconnectPatch(): StravaConnectionUpdate {
  return {
    access_token: null,
    expires_at: null,
    refresh_token: null,
    revoked: true,
    scope: null,
  };
}

export function buildStravaActivityErasurePatch(
  activityStartedAt: string,
  erasedAt: Date,
): ActivityUpdate {
  return {
    activity_name: ERASED_STRAVA_ACTIVITY_NAME,
    activity_started_at:
      normalizeActivityStartedAtForErasure(activityStartedAt),
    activity_started_local_at: null,
    distance_m: null,
    sport_type: null,
    strava_activity_id: null,
    strava_erased_at: erasedAt.toISOString(),
    strava_url: null,
    uploaded_or_created_at: null,
  };
}

export function normalizeActivityStartedAtForErasure(value: string) {
  const parsedDate = new Date(value);
  const parsedIsoDate = Number.isNaN(parsedDate.getTime())
    ? null
    : extractIsoDate(parsedDate.toISOString());
  const isoDate = extractIsoDate(value) ?? parsedIsoDate;

  return `${isoDate ?? "1970-01-01"}T12:00:00.000Z`;
}

function extractIsoDate(value: string) {
  const datePart = value.slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}
