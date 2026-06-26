import { describe, expect, it } from "vitest";
import {
  buildLeaderboardResponse,
  parseLeaderboardSearchParams,
  toLeaderboardRpcArgs,
  withEffectiveSeason,
} from "@/lib/leaderboard/query";
import type { LeaderboardRow } from "@/lib/leaderboard/types";

const activeSeasonId = "00000000-0000-4000-8000-000000002026";

describe("leaderboard query parsing", () => {
  it("defaults to active season when no season filter is supplied", () => {
    const query = parseLeaderboardSearchParams(new URLSearchParams());
    const effectiveQuery = withEffectiveSeason(query, activeSeasonId);

    expect(query.useActiveSeasonDefault).toBe(true);
    expect(effectiveQuery.filters.seasonId).toBe(activeSeasonId);
    expect(toLeaderboardRpcArgs(effectiveQuery.filters)).toMatchObject({
      p_season_id: activeSeasonId,
      p_category: null,
      p_source: null,
    });
  });

  it("keeps explicit all-season requests unscoped", () => {
    const query = parseLeaderboardSearchParams(
      new URLSearchParams("seasonId=all&source=strava&from=2026-06-01"),
    );
    const effectiveQuery = withEffectiveSeason(query, activeSeasonId);

    expect(query.useActiveSeasonDefault).toBe(false);
    expect(effectiveQuery.filters.seasonId).toBeNull();
    expect(toLeaderboardRpcArgs(effectiveQuery.filters)).toMatchObject({
      p_season_id: null,
      p_source: "strava",
      p_from: "2026-06-01",
    });
  });

  it("drops invalid filters instead of passing them to the database", () => {
    const query = parseLeaderboardSearchParams(
      new URLSearchParams(
        "seasonId=bad&source=email&from=2026-99-99&sort=missing&direction=sideways",
      ),
    );

    expect(query.filters.seasonId).toBeNull();
    expect(query.filters.source).toBeNull();
    expect(query.filters.from).toBeNull();
    expect(query.sortKey).toBe("totalPoints");
    expect(query.sortDirection).toBe("desc");
  });
});

describe("leaderboard response sorting", () => {
  it("sorts by total points descending and keeps place as stable tiebreaker", () => {
    const response = buildLeaderboardResponse({
      rows: [
        row({ place: 3, displayName: "Clara", totalPoints: 120 }),
        row({ place: 1, displayName: "Anna", totalPoints: 200 }),
        row({ place: 2, displayName: "Bernd", totalPoints: 200 }),
      ],
      filters: {
        seasonId: activeSeasonId,
        category: null,
        source: null,
        from: null,
        to: null,
        memberId: null,
        sportType: null,
      },
      options: {
        seasons: [],
        categories: [],
        sources: [],
        sportTypes: [],
      },
      sortKey: "totalPoints",
      sortDirection: "desc",
      generatedAt: new Date("2026-06-26T10:00:00.000Z"),
    });

    expect(response.rows.map((item) => item.displayName)).toEqual([
      "Anna",
      "Bernd",
      "Clara",
    ]);
    expect(response.generatedAt).toBe("2026-06-26T10:00:00.000Z");
  });

  it("keeps rows without last activity at the end", () => {
    const response = buildLeaderboardResponse({
      rows: [
        row({ place: 1, displayName: "Anna", lastActivityAt: null }),
        row({
          place: 2,
          displayName: "Bernd",
          lastActivityAt: "2026-06-20T10:00:00.000Z",
        }),
      ],
      filters: {
        seasonId: activeSeasonId,
        category: null,
        source: null,
        from: null,
        to: null,
        memberId: null,
        sportType: null,
      },
      options: {
        seasons: [],
        categories: [],
        sources: [],
        sportTypes: [],
      },
      sortKey: "lastActivityAt",
      sortDirection: "desc",
      generatedAt: new Date("2026-06-26T10:00:00.000Z"),
    });

    expect(response.rows.map((item) => item.displayName)).toEqual([
      "Bernd",
      "Anna",
    ]);
  });
});

function row(overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    place: 1,
    userId: "user-1",
    displayName: "Anna",
    seasonId: activeSeasonId,
    seasonName: "Test-Saison 2026",
    totalPoints: 100,
    totalRides: 1,
    samstagsFahrten: 1,
    mittwochsFahrten: 0,
    sonderevents: 0,
    manualPoints: 0,
    lastActivityAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}
