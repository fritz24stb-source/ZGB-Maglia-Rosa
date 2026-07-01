import { describe, expect, it, vi } from "vitest";
import {
  isScoreResultScored,
  rescoreActivities,
  scoreActivity,
  toActivityScoreUpdate,
} from "@/lib/scoring";
import type { ScorableActivity, ScoringRuleRow } from "@/lib/scoring";

const scoredAt = new Date("2026-06-26T10:00:00.000Z");

describe("scoring engine", () => {
  it("applies the matching standard rule", () => {
    const result = scoreActivity(
      activity({
        activity_name: "ZGB Fondo Samstag",
        activity_started_local_at: "2026-06-27T10:00:00+02:00",
      }),
      [rule({ name: "Samstags-Fondo", category: "fondo", points: 100 })],
      { scoredAt },
    );

    expect(result).toEqual({
      points: 100,
      category: "fondo",
      matchedRuleId: "rule-standard",
      matchedRuleName: "Samstags-Fondo",
      matchedCategory: "fondo",
      awardedPoints: 100,
      scoringReason: "Standardregel 'Samstags-Fondo' angewendet.",
      scoredAt: "2026-06-26T10:00:00.000Z",
    });
  });

  it("requires all configured keywords and allowed weekdays", () => {
    const result = scoreActivity(
      activity({
        activity_name: "ZGB Abendrunde",
        activity_started_local_at: "2026-06-26T18:00:00+02:00",
      }),
      [
        rule({
          name: "ZGB Zug",
          category: "zug",
          points: 80,
          name_keywords: ["zgb", "zug"],
          allowed_weekdays: [3, 4],
        }),
      ],
      { scoredAt },
    );

    expect(result.points).toBe(0);
    expect(result.matchedRuleId).toBeNull();
  });

  it("matches OR keyword alternatives case-insensitively", () => {
    const result = scoreActivity(
      activity({
        activity_name: "ZGB Abendrunde",
        activity_started_local_at: "2026-06-26T18:00:00+02:00",
      }),
      [
        rule({
          name: "ZGB oder Zug Abendrunde",
          category: "zug",
          points: 80,
          name_keywords: ["zug oder zgb", "ABENDRUNDE"],
          allowed_weekdays: [5],
        }),
      ],
      { scoredAt },
    );

    expect(result).toMatchObject({
      points: 80,
      matchedRuleId: "rule-standard",
      matchedRuleName: "ZGB oder Zug Abendrunde",
    });
  });

  it("scores Fondo for fondo or samstags keywords", () => {
    const result = scoreActivity(
      activity({
        activity_name: "ZGB Samstagsrunde",
        activity_started_local_at: "2026-06-27T10:00:00+02:00",
      }),
      [
        rule({
          name: "Samstags-Fondo",
          category: "fondo",
          points: 100,
          name_keywords: ["fondo oder samstags"],
          allowed_weekdays: [6, 7],
        }),
      ],
      { scoredAt },
    );

    expect(result).toMatchObject({
      category: "fondo",
      matchedRuleName: "Samstags-Fondo",
      points: 100,
    });
  });

  it("separates Wednesday categories with negative keywords", () => {
    const rules = [
      rule({
        id: "rule-scuderia",
        name: "Scuderia",
        category: "scuderia",
        points: 80,
        priority: 82,
        name_keywords: ["zgb oder scuderia", "kein zug", "kein scuola"],
        allowed_weekdays: [3, 4],
      }),
      rule({
        id: "rule-zug",
        name: "ZGB Zug",
        category: "zug",
        points: 80,
        priority: 81,
        name_keywords: ["zgb oder zug", "kein scuderia", "kein scuola"],
        allowed_weekdays: [3, 4],
      }),
      rule({
        id: "rule-scuola",
        name: "Scuola",
        category: "scuola",
        points: 80,
        priority: 80,
        name_keywords: ["zgb oder scuola", "kein zug", "kein scuderia"],
        allowed_weekdays: [3, 4],
      }),
    ];

    expect(scoreWednesdayRide("ZGB Scuderia Feierabend", rules)).toMatchObject({
      category: "scuderia",
      matchedRuleId: "rule-scuderia",
    });
    expect(scoreWednesdayRide("ZGB Zug Feierabend", rules)).toMatchObject({
      category: "zug",
      matchedRuleId: "rule-zug",
    });
    expect(scoreWednesdayRide("ZGB Scuola Feierabend", rules)).toMatchObject({
      category: "scuola",
      matchedRuleId: "rule-scuola",
    });
    expect(scoreWednesdayRide("ZGB Feierabend", rules)).toMatchObject({
      category: "scuderia",
      matchedRuleId: "rule-scuderia",
    });
  });

  it("prefers a higher-priority Sonderevent rule from the database", () => {
    const result = scoreActivity(
      activity({
        activity_name: "Sommer Classic Fondo",
        activity_started_local_at: "2026-06-20T09:00:00+02:00",
        distance_m: 125000,
      }),
      [
        rule({
          id: "rule-standard",
          name: "Samstags-Fondo",
          category: "fondo",
          points: 100,
          priority: 100,
          name_keywords: ["fondo"],
          allowed_weekdays: [6],
        }),
        rule({
          id: "rule-special",
          name: "Sommer Classic",
          category: "sonderevent",
          points: 250,
          rule_type: "special",
          priority: 200,
          name_keywords: ["sommer", "classic"],
          allowed_weekdays: [6],
          valid_from: "2026-06-01T00:00:00.000Z",
          valid_until: "2026-06-30T23:59:59.999Z",
          min_distance_m: 100000,
        }),
      ],
      { scoredAt },
    );

    expect(result.points).toBe(250);
    expect(result.category).toBe("sonderevent");
    expect(result.matchedRuleId).toBe("rule-special");
    expect(result.scoringReason).toBe(
      "Sonderevent 'Sommer Classic' angewendet.",
    );
  });

  it("prefers a Sonderevent over a matching Fondo standard rule", () => {
    const result = scoreActivity(
      activity({
        activity_name: "Sommer Classic Samstagsrunde",
        activity_started_local_at: "2026-06-20T09:00:00+02:00",
      }),
      [
        rule({
          id: "rule-fondo",
          name: "Samstags-Fondo",
          category: "fondo",
          points: 100,
          priority: 100,
          name_keywords: ["fondo oder samstags"],
          allowed_weekdays: [6],
        }),
        rule({
          id: "rule-special",
          name: "Sommer Classic",
          category: "sonderevent",
          points: 250,
          rule_type: "special",
          priority: 10,
          name_keywords: ["sommer", "classic"],
          allowed_weekdays: [6],
        }),
      ],
      { scoredAt },
    );

    expect(result).toMatchObject({
      category: "sonderevent",
      matchedRuleId: "rule-special",
      points: 250,
    });
  });

  it("ignores season-specific rules from other seasons", () => {
    const result = scoreActivity(
      activity({ season_id: "season-2026", activity_name: "Sommer Classic" }),
      [
        rule({
          id: "rule-other-season",
          season_id: "season-2025",
          name: "Sommer Classic",
          category: "sonderevent",
          rule_type: "special",
          name_keywords: ["sommer", "classic"],
        }),
      ],
      { scoredAt },
    );

    expect(result.points).toBe(0);
    expect(result.matchedRuleId).toBeNull();
  });

  it("blocks manual activities when the matching rule disallows them", () => {
    const result = scoreActivity(
      activity({
        source: "manual",
        manually_entered: true,
        activity_name: "ZGB Fondo Samstag",
      }),
      [rule({ manual_entry_allowed: false })],
      { scoredAt },
    );

    expect(result.points).toBe(0);
    expect(result.matchedRuleId).toBeNull();
  });

  it("applies admin scoring overrides without normal rule matching", () => {
    const result = scoreActivity(
      activity({
        activity_name: "Private Runde",
        activity_started_local_at: "2026-06-26T18:00:00+02:00",
        scoring_override_rule_id: "rule-standard",
      }),
      [rule()],
      { scoredAt },
    );

    expect(result).toMatchObject({
      points: 100,
      matchedRuleId: "rule-standard",
      scoringReason: "Admin-Override 'Samstags-Fondo' angewendet.",
    });
  });

  it("builds the database update payload from a scoring result", () => {
    const score = scoreActivity(activity(), [rule()], { scoredAt });

    expect(toActivityScoreUpdate(score)).toEqual({
      category: "fondo",
      points: 100,
      matched_rule_id: "rule-standard",
      matched_rule_name: "Samstags-Fondo",
      matched_category: "fondo",
      awarded_points: 100,
      scoring_reason: "Standardregel 'Samstags-Fondo' angewendet.",
      scored_at: "2026-06-26T10:00:00.000Z",
    });
  });

  it("classifies only matched positive results as scored", () => {
    expect(isScoreResultScored(scoreActivity(activity(), [rule()]))).toBe(true);
    expect(
      isScoreResultScored(
        scoreActivity(activity({ activity_name: "Private Runde" }), [rule()]),
      ),
    ).toBe(false);
  });
});

describe("re-scoring", () => {
  it("updates all activities and returns a batch summary", async () => {
    const updateActivity = vi.fn();

    const summary = await rescoreActivities({
      activities: [
        activity({ id: "activity-1", activity_name: "ZGB Fondo Samstag" }),
        activity({ id: "activity-2", activity_name: "Private Runde" }),
      ],
      rules: [rule()],
      scoredAt,
      updateActivity,
    });

    expect(summary).toEqual({
      total: 2,
      updated: 2,
      matched: 1,
      unmatched: 1,
      failed: 0,
      errors: [],
    });
    expect(updateActivity).toHaveBeenCalledTimes(2);
    expect(updateActivity).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "activity-1" }),
      expect.objectContaining({ matchedRuleId: "rule-standard" }),
      expect.objectContaining({ points: 100 }),
    );
    expect(updateActivity).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "activity-2" }),
      expect.objectContaining({ matchedRuleId: null }),
      expect.objectContaining({ points: 0 }),
    );
  });
});

function rule(overrides: Partial<ScoringRuleRow> = {}): ScoringRuleRow {
  return {
    id: "rule-standard",
    season_id: null,
    name: "Samstags-Fondo",
    category: "fondo",
    points: 100,
    rule_type: "standard",
    priority: 100,
    name_keywords: ["fondo"],
    allowed_weekdays: [6, 7],
    valid_from: null,
    valid_until: null,
    min_distance_m: null,
    allowed_sport_types: null,
    manual_entry_allowed: true,
    manual_entry_valid_from_rule: "weekly:saturday:10:00:Europe/Berlin",
    manual_entry_valid_until_rule: "weekly:sunday:18:00:Europe/Berlin",
    max_manual_entries_per_user: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function scoreWednesdayRide(activityName: string, rules: ScoringRuleRow[]) {
  return scoreActivity(
    activity({
      activity_name: activityName,
      activity_started_local_at: "2026-07-01T18:00:00+02:00",
    }),
    rules,
    { scoredAt },
  );
}

function activity(overrides: Partial<ScorableActivity> = {}): ScorableActivity {
  return {
    id: "activity-1",
    season_id: "season-2026",
    source: "strava",
    activity_name: "ZGB Fondo Samstag",
    sport_type: "Ride",
    distance_m: null,
    activity_started_at: "2026-06-27T08:00:00.000Z",
    activity_started_local_at: "2026-06-27T10:00:00+02:00",
    status: "active",
    manually_entered: false,
    ...overrides,
  };
}
