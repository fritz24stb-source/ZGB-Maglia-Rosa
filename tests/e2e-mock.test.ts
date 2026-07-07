import { describe, expect, it } from "vitest";
import {
  buildLeaderboardResponse,
  normalizeLeaderboardRow,
} from "@/lib/leaderboard/query";
import {
  isScoreResultScored,
  scoreActivity,
  toActivityScoreUpdate,
} from "@/lib/scoring";
import type { ScorableActivity, ScoringRuleRow } from "@/lib/scoring";
import {
  fetchStravaActivity,
  mapStravaActivityToActivityWrite,
  type StravaDetailedActivity,
} from "@/lib/strava/activity";
import type { LeaderboardRpcRow } from "@/lib/leaderboard/types";

const MOCK_SEASON_ID = "00000000-0000-4000-8000-000000002026";

describe("mocked end-to-end scoring and leaderboard flow", () => {
  it("maps Strava payloads, scores activities and returns only ranking aggregates", () => {
    const rules = [
      scoringRule({
        allowed_weekdays: [6, 7],
        category: "fondo",
        id: "rule-fondo",
        name: "Samstags-Fondo",
        name_keywords: ["fondo"],
        points: 100,
      }),
      scoringRule({
        allowed_weekdays: [3, 4],
        category: "zug",
        id: "rule-zgb",
        name: "ZGB Zug",
        name_keywords: ["zgb"],
        points: 80,
      }),
    ];
    const annaFondo = scoreMockStravaActivity({
      activity: {
        athlete: { id: 101 },
        created_at: "2026-06-27T08:05:00Z",
        distance: 125000,
        id: 9001,
        name: "ZGB Fondo Samstag",
        sport_type: "Ride",
        start_date: "2026-06-27T08:00:00Z",
        start_date_local: "2026-06-27T10:00:00",
      },
      rules,
      userId: "user-anna",
    });
    const annaZgb = scoreMockStravaActivity({
      activity: {
        athlete: { id: 101 },
        created_at: "2026-07-01T16:05:00Z",
        distance: 42000,
        id: 9002,
        name: "ZGB Feierabend",
        sport_type: "Ride",
        start_date: "2026-07-01T16:00:00Z",
        start_date_local: "2026-07-01T18:00:00",
      },
      rules,
      userId: "user-anna",
    });
    const berndFondo = scoreMockStravaActivity({
      activity: {
        athlete: { id: 202 },
        created_at: "2026-06-28T07:05:00Z",
        distance: 98000,
        id: 9003,
        name: "Fondo Sonntag",
        sport_type: "Ride",
        start_date: "2026-06-28T07:00:00Z",
        start_date_local: "2026-06-28T09:00:00",
      },
      rules,
      userId: "user-bernd",
    });

    const response = buildLeaderboardResponse({
      filters: {
        category: null,
        from: null,
        memberId: null,
        seasonId: MOCK_SEASON_ID,
        source: null,
        sportType: null,
        to: null,
      },
      generatedAt: new Date("2026-06-30T10:00:00.000Z"),
      options: {
        categories: [{ label: "Samstags-Fondo", value: "fondo" }],
        seasons: [
          {
            endsOn: "2026-12-31",
            isActive: true,
            label: "Mock Saison 2026",
            startsOn: "2026-01-01",
            value: MOCK_SEASON_ID,
          },
        ],
        sources: [{ label: "Strava", value: "strava" }],
        sportTypes: [{ label: "Ride", value: "Ride" }],
      },
      rows: [
        aggregateRpcRow({
          activities: [annaFondo, annaZgb],
          displayName: "Anna",
          place: 1,
          userId: "user-anna",
        }),
        aggregateRpcRow({
          activities: [berndFondo],
          displayName: "Bernd",
          place: 2,
          userId: "user-bernd",
        }),
      ].map(normalizeLeaderboardRow),
      sortDirection: "desc",
      sortKey: "totalPoints",
    });

    expect(response.rows).toHaveLength(2);
    expect(response.rows[0]).toMatchObject({
      displayName: "Anna",
      samstagsFahrten: 1,
      mittwochsFahrten: 1,
      totalPoints: 180,
      totalRides: 2,
    });
    expect(response.rows[1]).toMatchObject({
      displayName: "Bernd",
      totalPoints: 100,
      totalRides: 1,
    });
    expect(JSON.stringify(response)).not.toMatch(/9001|9002|9003|strava_url/);
  });
});

describe("Strava API error handling", () => {
  it("turns Strava 429 responses into an actionable rate-limit error", async () => {
    await expect(
      fetchStravaActivity(
        9001,
        "server-only-token",
        async () =>
          new Response("too many requests", {
            headers: { "retry-after": "60" },
            status: 429,
          }),
      ),
    ).rejects.toMatchObject({
      message:
        "Strava Rate-Limit erreicht. Bitte Sync später erneut ausführen (Retry-After: ca. 60 Sekunden).",
      status: 429,
    });
  });
});

type ScoredMockActivity = ScorableActivity & {
  category: string | null;
  points: number;
};

function scoreMockStravaActivity(input: {
  activity: StravaDetailedActivity;
  rules: ScoringRuleRow[];
  userId: string;
}): ScoredMockActivity {
  const activityWrite = mapStravaActivityToActivityWrite({
    activity: input.activity,
    seasonId: MOCK_SEASON_ID,
    userId: input.userId,
  });
  const scorableActivity = {
    id: `mock-${input.activity.id}`,
    activity_name: activityWrite.activity_name ?? "Mock Aktivität",
    activity_started_at:
      activityWrite.activity_started_at ?? "2026-01-01T00:00:00.000Z",
    activity_started_local_at: activityWrite.activity_started_local_at ?? null,
    distance_m: activityWrite.distance_m ?? null,
    manually_entered: false,
    season_id: MOCK_SEASON_ID,
    source: "strava",
    sport_type: activityWrite.sport_type ?? null,
    status: "active",
  } satisfies ScorableActivity;
  const score = scoreActivity(scorableActivity, input.rules, {
    scoredAt: new Date("2026-06-30T10:00:00.000Z"),
  });
  const scoreUpdate = toActivityScoreUpdate(score);

  expect(isScoreResultScored(score)).toBe(true);

  return {
    ...scorableActivity,
    category: scoreUpdate.category,
    points: scoreUpdate.points ?? 0,
  };
}

function aggregateRpcRow(input: {
  activities: ScoredMockActivity[];
  displayName: string;
  place: number;
  userId: string;
}): LeaderboardRpcRow {
  return {
    display_name: input.displayName,
    last_activity_at:
      input.activities
        .map((activity) => activity.activity_started_at)
        .sort()
        .at(-1) ?? null,
    manual_points: 0,
    mittwochs_fahrten: input.activities.filter((activity) =>
      ["zug", "scuola", "scuderia"].includes(activity.category ?? ""),
    ).length,
    place: input.place,
    samstags_fahrten: input.activities.filter(
      (activity) => activity.category === "fondo",
    ).length,
    season_id: MOCK_SEASON_ID,
    season_name: "Mock Saison 2026",
    sonderevents: input.activities.filter(
      (activity) => activity.category === "sonderevent",
    ).length,
    total_points: input.activities.reduce(
      (sum, activity) => sum + activity.points,
      0,
    ),
    total_rides: input.activities.length,
    user_id: input.userId,
  };
}

function scoringRule(overrides: Partial<ScoringRuleRow>): ScoringRuleRow {
  return {
    allowed_sport_types: ["Ride"],
    allowed_weekdays: null,
    category: "fondo",
    created_at: "2026-01-01T00:00:00.000Z",
    id: "rule",
    is_active: true,
    manual_entry_allowed: true,
    manual_entry_valid_from_rule: null,
    manual_entry_valid_until_rule: null,
    max_manual_entries_per_user: 1,
    min_distance_m: null,
    name: "Regel",
    name_keywords: ["fondo"],
    points: 100,
    priority: 100,
    rule_type: "standard",
    season_id: MOCK_SEASON_ID,
    updated_at: "2026-01-01T00:00:00.000Z",
    valid_from: null,
    valid_until: null,
    ...overrides,
  };
}
