import { describe, expect, it, vi } from "vitest";
import {
  loadLeaderboardData,
  type LeaderboardDataSource,
} from "@/lib/leaderboard/load";
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
        "seasonId=bad&source=email&from=2026-99-99&sportType=Ride&sort=missing&direction=sideways",
      ),
    );

    expect(query.filters.seasonId).toBeNull();
    expect(query.filters.source).toBeNull();
    expect(query.filters.from).toBeNull();
    expect(query.filters.sportType).toBeNull();
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

  it("sorts names ascending", () => {
    const response = buildLeaderboardResponse({
      rows: [
        row({ place: 2, displayName: "Bernd" }),
        row({ place: 1, displayName: "Anna" }),
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
      },
      sortKey: "displayName",
      sortDirection: "asc",
      generatedAt: new Date("2026-06-26T10:00:00.000Z"),
    });

    expect(response.rows.map((item) => item.displayName)).toEqual([
      "Anna",
      "Bernd",
    ]);
  });
});

describe("leaderboard data loader", () => {
  it("loads options and rows with the effective active season", async () => {
    const loadRows = vi.fn<LeaderboardDataSource["loadRows"]>(async () => [
      {
        display_name: "Anna",
        last_activity_at: "2026-07-20T10:00:00.000Z",
        manual_points: 0,
        mittwochs_fahrten: 1,
        place: 1,
        samstags_fahrten: 2,
        season_id: activeSeasonId,
        season_name: "Saison 2026",
        sonderevents: 0,
        total_points: 300,
        total_rides: 3,
        user_id: "user-anna",
      },
    ]);
    const dataSource: LeaderboardDataSource = {
      loadSeasons: async () => [
        {
          id: activeSeasonId,
          name: "Saison 2026",
          starts_on: "2026-01-01",
          ends_on: "2026-12-31",
          is_active: true,
        },
      ],
      loadRules: async () => [
        {
          category: "fondo",
          name: "Samstags-Fondo",
          rule_type: "standard",
        },
        {
          category: "sonderevent",
          name: "Sonderfahrt",
          rule_type: "special",
        },
      ],
      loadRows,
    };

    const response = await loadLeaderboardData(
      new URLSearchParams("source=manual&sort=displayName&direction=asc"),
      dataSource,
    );

    expect(loadRows).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonId: activeSeasonId,
        source: "manual",
      }),
    );
    expect(response.sort).toEqual({ key: "displayName", direction: "asc" });
    expect(response.rows[0]).toMatchObject({
      displayName: "Anna",
      totalPoints: 300,
    });
    expect(response.options.categories).toEqual([
      { label: "Samstags-Fondo", value: "fondo" },
      { label: "Sonderevents", value: "sonderevent" },
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
    ...overrides,
  };
}
