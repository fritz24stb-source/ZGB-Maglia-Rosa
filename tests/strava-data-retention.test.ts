import { describe, expect, it } from "vitest";
import {
  buildStravaActivityErasurePatch,
  buildStravaConnectionDisconnectPatch,
  ERASED_STRAVA_ACTIVITY_NAME,
  normalizeActivityStartedAtForErasure,
} from "@/lib/strava/data-retention-helpers";

describe("strava data retention helpers", () => {
  it("clears tokens and marks a connection revoked on disconnect", () => {
    expect(buildStravaConnectionDisconnectPatch()).toEqual({
      access_token: null,
      expires_at: null,
      refresh_token: null,
      revoked: true,
      scope: null,
    });
  });

  it("builds an activity erasure patch without Strava raw details", () => {
    const patch = buildStravaActivityErasurePatch(
      "2026-07-01T18:34:12+02:00",
      new Date("2026-07-07T10:00:00.000Z"),
    );

    expect(patch).toMatchObject({
      activity_name: ERASED_STRAVA_ACTIVITY_NAME,
      activity_started_at: "2026-07-01T12:00:00.000Z",
      activity_started_local_at: null,
      distance_m: null,
      sport_type: null,
      strava_activity_id: null,
      strava_erased_at: "2026-07-07T10:00:00.000Z",
      strava_url: null,
      uploaded_or_created_at: null,
    });
  });

  it("reduces activity start timestamps to a date-only noon marker", () => {
    expect(normalizeActivityStartedAtForErasure("2026-07-01T05:12:00Z")).toBe(
      "2026-07-01T12:00:00.000Z",
    );
  });
});
