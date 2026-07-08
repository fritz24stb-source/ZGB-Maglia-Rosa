import { describe, expect, it } from "vitest";
import {
  addWebhookOwnerLabels,
  dedupeWebhookEventsForDisplay,
  getWebhookOwnerLabel,
} from "@/lib/admin/webhook-events";

describe("admin webhook event display", () => {
  const connections = [
    { strava_athlete_id: 456, user_id: "user-1" },
    { strava_athlete_id: 789, user_id: "missing-profile" },
  ];
  const profiles = [{ display_name: "Max Muster", id: "user-1" }];

  it("uses the member name mapped from Strava athlete id", () => {
    expect(getWebhookOwnerLabel(456, connections, profiles)).toBe("Max Muster");
  });

  it("falls back to a clear athlete id when no profile is found", () => {
    expect(getWebhookOwnerLabel(789, connections, profiles)).toBe(
      "Athlete ID 789",
    );
    expect(getWebhookOwnerLabel(999, connections, profiles)).toBe(
      "Athlete ID 999",
    );
  });

  it("adds owner labels to webhook rows without changing event fields", () => {
    expect(
      addWebhookOwnerLabels(
        [
          {
            id: "event-1",
            object_id: 123,
            owner_id: 456,
          },
        ],
        connections,
        profiles,
      ),
    ).toEqual([
      {
        id: "event-1",
        object_id: 123,
        ownerLabel: "Max Muster",
        owner_id: 456,
      },
    ]);
  });

  it("keeps only the latest duplicate-looking webhook event per object", () => {
    const events = [
      webhookEvent({
        id: "older-update",
        created_at: "2026-07-07T08:00:00.000Z",
      }),
      webhookEvent({
        id: "newer-update",
        created_at: "2026-07-07T08:05:00.000Z",
      }),
      webhookEvent({
        id: "create-event",
        aspect_type: "create",
        created_at: "2026-07-07T08:03:00.000Z",
      }),
    ];

    expect(
      dedupeWebhookEventsForDisplay(events, 8).map((event) => event.id),
    ).toEqual(["newer-update", "create-event"]);
  });
});

function webhookEvent(
  overrides: Partial<{
    aspect_type: string;
    created_at: string;
    id: string;
    object_id: number;
    object_type: string;
    owner_id: number;
  }> = {},
) {
  return {
    aspect_type: "update",
    created_at: "2026-07-07T08:00:00.000Z",
    id: "event",
    object_id: 123,
    object_type: "activity",
    owner_id: 456,
    ...overrides,
  };
}
