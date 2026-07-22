import { describe, expect, it } from "vitest";
import { shouldRunAutomaticUserResync } from "@/lib/strava/resync-policy";
import {
  formatUserSyncNotificationMessage,
  formatUserSyncSummary,
} from "@/lib/strava/sync-summary";

describe("automatic Strava user resync", () => {
  it("runs when no connection exists before connecting", () => {
    expect(shouldRunAutomaticUserResync(null)).toBe(true);
  });

  it("does not run again for an existing active connection", () => {
    expect(
      shouldRunAutomaticUserResync({
        revoked: false,
        user_id: "user-1",
      }),
    ).toBe(false);
  });

  it("does not treat a disconnect as deleted Strava data", () => {
    expect(
      shouldRunAutomaticUserResync({
        revoked: true,
        user_id: "user-1",
      }),
    ).toBe(false);
  });

  it("formats automatic and manual resync results consistently", () => {
    expect(
      formatUserSyncSummary({
        activitiesFetched: 4,
        apiRequests: 2,
        completionStatus: "partial_rate_budget",
        failed: 1,
        skipped: 2,
        synced: 3,
        users: 1,
      }),
    ).toBe(
      "1 User, 3 synchronisiert, 4 von Strava geladen, 2 API-Anfragen, 2 übersprungen, 1 fehlgeschlagen, unvollständig: API-Reserve erreicht",
    );
  });

  it("includes the user name in automatic resync notifications", () => {
    expect(
      formatUserSyncNotificationMessage(
        "Max Mustermann",
        "1 User, 3 synchronisiert",
      ),
    ).toBe("Max Mustermann: 1 User, 3 synchronisiert");
  });
});
