import { describe, expect, it } from "vitest";
import {
  buildRideAnalysis,
  type AnalysisActivity,
  type AnalysisScoringRule,
} from "@/lib/analysis/rides";

describe("ride analysis aggregation", () => {
  it("groups ZGB Zug rides once per date and counts unique category participants", () => {
    const analysis = buildRideAnalysis(
      [
        activity({
          activity_started_local_at: "2026-07-01T18:00:00+02:00",
          category: "zug",
          user_id: "user-1",
        }),
        activity({
          activity_started_local_at: "2026-07-01T18:05:00+02:00",
          category: "zug",
          user_id: "user-1",
        }),
        activity({
          activity_started_local_at: "2026-07-01T18:10:00+02:00",
          category: "scuderia",
          user_id: "user-2",
        }),
        activity({
          activity_started_local_at: "2026-07-01T18:15:00+02:00",
          category: "scuola",
          user_id: "user-3",
        }),
        activity({
          activity_started_local_at: "2026-07-08T18:00:00+02:00",
          category: "zug",
          user_id: "user-4",
        }),
      ],
      [rule({ id: "rule-standard" })],
    );

    expect(analysis.wednesdayRides).toHaveLength(2);
    expect(analysis.wednesdayRides[1]).toMatchObject({
      date: "2026-07-01",
      participantCount: 3,
      scuolaCount: 1,
      scuderiaCount: 1,
      title: "ZGB Zug",
      zugCount: 1,
    });
    expect(analysis.wednesdayGraph).toEqual([
      { date: "2026-07-01", participantCount: 3 },
      { date: "2026-07-08", participantCount: 1 },
    ]);
    expect(analysis.summary.wednesdayParticipantAverage).toBe(2);
  });

  it("groups Fondo and special events by date with participant counts", () => {
    const analysis = buildRideAnalysis(
      [
        activity({
          activity_started_local_at: "2026-07-04T09:00:00+02:00",
          category: "fondo",
          user_id: "user-1",
        }),
        activity({
          activity_started_local_at: "2026-07-04T09:05:00+02:00",
          category: "fondo",
          user_id: "user-2",
        }),
        activity({
          activity_started_local_at: "2026-07-11T08:00:00+02:00",
          category: "sonderevent",
          matched_rule_id: "rule-special",
          matched_rule_name: "Sommer-Challenge",
          user_id: "user-1",
        }),
        activity({
          activity_started_local_at: "2026-07-11T08:05:00+02:00",
          category: "sonderevent",
          matched_rule_id: "rule-special",
          matched_rule_name: "Sommer-Challenge",
          user_id: "user-3",
        }),
      ],
      [
        rule({ id: "rule-standard" }),
        rule({
          id: "rule-special",
          name: "Sommer-Challenge",
          rule_type: "special",
        }),
      ],
    );

    expect(analysis.fondoRides).toEqual([
      expect.objectContaining({
        date: "2026-07-04",
        participantCount: 2,
        title: "Samstags-Fondo",
      }),
    ]);
    expect(analysis.eventRides).toEqual([
      expect.objectContaining({
        date: "2026-07-11",
        participantCount: 2,
        title: "Sommer-Challenge",
      }),
    ]);
    expect(analysis.summary.fondoParticipantAverage).toBe(2);
    expect(analysis.summary.eventParticipantAverage).toBe(2);
  });

  it("does not use raw activity names as event titles", () => {
    const rawActivityName = "Private Strava Titel";
    const analysis = buildRideAnalysis(
      [
        {
          ...activity({
            category: "sonderevent",
            matched_rule_id: null,
            matched_rule_name: null,
            user_id: "user-1",
          }),
          activity_name: rawActivityName,
        } as unknown as AnalysisActivity,
      ],
      [],
    );

    expect(JSON.stringify(analysis)).not.toContain(rawActivityName);
    expect(analysis.eventRides[0]).toMatchObject({
      title: "Sonderevent",
    });
  });

  it("uses rule names for event titles", () => {
    const analysis = buildRideAnalysis(
      [
        activity({
          category: "sonderevent",
          matched_rule_id: "rule-special",
          matched_rule_name: null,
          user_id: "user-1",
        }),
      ],
      [rule({ id: "rule-special", name: "Regelname", rule_type: "special" })],
    );

    expect(analysis.eventRides[0]).toMatchObject({
      title: "Regelname",
    });
  });
});

function activity(overrides: Partial<AnalysisActivity>): AnalysisActivity {
  return {
    activity_started_at: "2026-07-01T16:00:00.000Z",
    activity_started_local_at: null,
    category: "zug",
    matched_rule_id: "rule-standard",
    matched_rule_name: "Standardregel",
    user_id: "user-1",
    ...overrides,
  };
}

function rule(overrides: Partial<AnalysisScoringRule>): AnalysisScoringRule {
  return {
    category: "zug",
    id: "rule-standard",
    name: "Standardregel",
    rule_type: "standard",
    ...overrides,
  };
}
