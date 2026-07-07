import { describe, expect, it } from "vitest";
import {
  addWebhookOwnerLabels,
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
});
