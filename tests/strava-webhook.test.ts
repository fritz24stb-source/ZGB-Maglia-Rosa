import { describe, expect, it } from "vitest";
import {
  getStravaActivityAthleteId,
  getStravaActivityLocalDate,
  mapStravaActivityToActivityWrite,
} from "@/lib/strava/activity";
import {
  isActivityDeleteEvent,
  isActivityFetchEvent,
  isStravaDeauthorizationEvent,
  parseStravaWebhookEvent,
  verifyStravaWebhookChallenge,
  webhookEventTimeToIso,
} from "@/lib/strava/webhook";

describe("strava webhook verification", () => {
  it("returns the Strava challenge for a valid subscribe verification", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "verify-me",
      "hub.challenge": "challenge-value",
    });

    expect(verifyStravaWebhookChallenge(params, "verify-me")).toEqual({
      ok: true,
      challenge: "challenge-value",
    });
  });

  it("rejects an invalid verification token", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "challenge-value",
    });

    expect(verifyStravaWebhookChallenge(params, "verify-me")).toEqual({
      ok: false,
      status: 403,
      error: "Invalid webhook verify token.",
    });
  });
});

describe("strava webhook events", () => {
  it("parses activity fetch events and normalizes event time", () => {
    const event = parseStravaWebhookEvent({
      object_type: "activity",
      object_id: 123,
      aspect_type: "create",
      owner_id: 456,
      event_time: 1782468000,
      subscription_id: 789,
    });

    expect(event).toMatchObject({
      object_type: "activity",
      object_id: 123,
      aspect_type: "create",
      owner_id: 456,
      event_time: 1782468000,
      subscription_id: 789,
    });
    expect(isActivityFetchEvent(event)).toBe(true);
    expect(webhookEventTimeToIso(event.event_time)).toBe(
      "2026-06-26T10:00:00.000Z",
    );
  });

  it("detects delete and deauthorization events", () => {
    expect(
      isActivityDeleteEvent(
        parseStravaWebhookEvent({
          object_type: "activity",
          object_id: 123,
          aspect_type: "delete",
          owner_id: 456,
          event_time: 1782468000,
        }),
      ),
    ).toBe(true);

    expect(
      isStravaDeauthorizationEvent(
        parseStravaWebhookEvent({
          object_type: "athlete",
          object_id: 456,
          aspect_type: "update",
          owner_id: 456,
          event_time: 1782468000,
          updates: {
            authorized: "false",
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("strava activity mapping", () => {
  it("maps a detailed Strava activity to the activities table payload", () => {
    const activity = {
      id: 123,
      name: "ZGB Fondo Samstag",
      sport_type: "Ride",
      distance: 125000,
      start_date: "2026-06-27T08:00:00Z",
      start_date_local: "2026-06-27T10:00:00",
      created_at: "2026-06-27T08:05:00Z",
      athlete: {
        id: 456,
      },
    };

    expect(
      mapStravaActivityToActivityWrite({
        activity,
        userId: "user-1",
        seasonId: "season-2026",
      }),
    ).toEqual({
      user_id: "user-1",
      season_id: "season-2026",
      strava_activity_id: 123,
      source: "strava",
      activity_name: "ZGB Fondo Samstag",
      sport_type: "Ride",
      distance_m: 125000,
      activity_started_at: "2026-06-27T08:00:00.000Z",
      activity_started_local_at: "2026-06-27T10:00:00.000Z",
      uploaded_or_created_at: "2026-06-27T08:05:00.000Z",
      status: "active",
      manually_entered: false,
      manual_comment: null,
      manual_entry_key: null,
      strava_url: "https://www.strava.com/activities/123",
    });
    expect(getStravaActivityLocalDate(activity)).toBe("2026-06-27");
    expect(getStravaActivityAthleteId(activity)).toBe(456);
  });
});
