import { describe, expect, it } from "vitest";
import {
  buildManualEntryContexts,
  getNextManualEntryOpening,
} from "@/lib/manual-entry/options";
import {
  getWeeklyWindowStatus,
  parseManualLocalDateTime,
} from "@/lib/manual-entry/time";
import type {
  ManualEntryWindowRow,
  ScoringRuleRow,
} from "@/lib/manual-entry/types";

describe("manual entry time windows", () => {
  it("keeps the Fondo window open from Saturday 10:00 through Sunday 18:00", () => {
    const config = {
      weekdayStart: 6,
      timeStart: { hour: 10, minute: 0 },
      weekdayEnd: 7,
      timeEnd: { hour: 18, minute: 0 },
      timeZone: "Europe/Berlin",
    };

    expect(
      getWeeklyWindowStatus(config, new Date("2026-06-27T08:00:00.000Z"))
        .isOpen,
    ).toBe(true);
    expect(
      getWeeklyWindowStatus(config, new Date("2026-06-28T16:00:00.000Z"))
        .isOpen,
    ).toBe(true);

    const closedStatus = getWeeklyWindowStatus(
      config,
      new Date("2026-06-28T16:01:00.000Z"),
    );

    expect(closedStatus.isOpen).toBe(false);
    expect(closedStatus.nextOpensAt?.toISOString()).toBe(
      "2026-07-04T08:00:00.000Z",
    );
  });

  it("keeps the midweek window open from Wednesday 18:00 through Thursday 18:00", () => {
    const config = {
      weekdayStart: 3,
      timeStart: { hour: 18, minute: 0 },
      weekdayEnd: 4,
      timeEnd: { hour: 18, minute: 0 },
      timeZone: "Europe/Berlin",
    };

    expect(
      getWeeklyWindowStatus(config, new Date("2026-07-01T16:00:00.000Z"))
        .isOpen,
    ).toBe(true);
    expect(
      getWeeklyWindowStatus(config, new Date("2026-07-02T16:00:00.000Z"))
        .isOpen,
    ).toBe(true);
    expect(
      getWeeklyWindowStatus(config, new Date("2026-07-02T16:01:00.000Z"))
        .isOpen,
    ).toBe(false);
  });

  it("parses local manual activity times with the Berlin offset", () => {
    const parsed = parseManualLocalDateTime("2026-07-01T18:30");

    expect(parsed?.utcDate.toISOString()).toBe("2026-07-01T16:30:00.000Z");
    expect(parsed?.localIsoWithOffset).toBe("2026-07-01T18:30:00+02:00");
    expect(parsed?.localDate).toBe("2026-07-01");
  });
});

describe("manual entry options", () => {
  it("marks an open category as used when the window key already exists", () => {
    const now = new Date("2026-07-01T16:30:00.000Z");
    const existingEntryCounts = new Map([
      ["category:zug:2026-07-01T16:00:00.000Z", 1],
    ]);

    const contexts = buildManualEntryContexts({
      now,
      existingEntryCounts,
      windows: [
        windowRow({
          category: "zug",
          weekday_start: 3,
          time_start: "18:00:00",
          weekday_end: 4,
          time_end: "18:00:00",
          points: 80,
        }),
      ],
      rules: [
        rule({
          id: "rule-zgb",
          name: "ZGB Zug",
          category: "zug",
          points: 80,
          name_keywords: ["zgb", "zug"],
          allowed_weekdays: [3, 4],
        }),
      ],
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      status: "used",
      manualEntryKey: "category:zug:2026-07-01T16:00:00.000Z",
      remainingEntries: 0,
    });
  });

  it("uses fixed Sonderevent validity as a manual entry window", () => {
    const contexts = buildManualEntryContexts({
      now: new Date("2026-08-15T10:00:00.000Z"),
      existingEntryCounts: new Map(),
      windows: [],
      rules: [
        rule({
          id: "rule-special",
          name: "Sommer Classic",
          category: "sonderevent",
          points: 250,
          rule_type: "special",
          priority: 200,
          name_keywords: ["sommer", "classic"],
          valid_from: "2026-08-15T08:00:00.000Z",
          valid_until: "2026-08-15T18:00:00.000Z",
          manual_entry_valid_from_rule: null,
          manual_entry_valid_until_rule: null,
        }),
      ],
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      ruleId: "rule-special",
      label: "Sommer Classic",
      status: "open",
      manualEntryKey: "rule:rule-special:2026-08-15T08:00:00.000Z",
      points: 250,
    });
  });

  it("does not include a past fixed window in the manual entry options", () => {
    const contexts = buildManualEntryContexts({
      now: new Date("2026-08-16T10:00:00.000Z"),
      existingEntryCounts: new Map(),
      windows: [],
      rules: [
        rule({
          id: "rule-special",
          name: "Sommer Classic",
          category: "sonderevent",
          points: 250,
          rule_type: "special",
          priority: 200,
          name_keywords: ["sommer", "classic"],
          valid_from: "2026-08-15T08:00:00.000Z",
          valid_until: "2026-08-15T18:00:00.000Z",
          manual_entry_valid_from_rule: null,
          manual_entry_valid_until_rule: null,
        }),
      ],
    });

    expect(contexts).toHaveLength(0);
    expect(
      getNextManualEntryOpening(
        contexts.map((context) => ({ nextOpensAt: context.nextOpensAt })),
        new Date("2026-08-16T10:00:00.000Z"),
      ),
    ).toBeNull();
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

function windowRow(
  overrides: Partial<ManualEntryWindowRow> = {},
): ManualEntryWindowRow {
  return {
    id: "window-fondo",
    category: "fondo",
    weekday_start: 6,
    time_start: "10:00:00",
    weekday_end: 7,
    time_end: "18:00:00",
    points: 100,
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
