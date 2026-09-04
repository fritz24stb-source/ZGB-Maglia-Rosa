import { describe, expect, it } from "vitest";
import { buildCiclaminoAnalysis } from "@/lib/analysis/ciclamino";
import type { CiclaminoSprintDay } from "@/lib/classifications/types";

describe("ciclamino recent comparison", () => {
  it("ignores future scheduled days when selecting the three-week window", () => {
    const scoredDay: CiclaminoSprintDay = {
      key: "season:2026-08-19",
      seasonId: "season",
      seasonName: "Saison",
      sprintDate: "2026-08-19",
      adminOverrideUserId: null,
      combativeRider: null,
      combativeSource: null,
      voteSummary: [],
      votingWindow: {
        opensAt: "2026-08-19T16:00:00Z",
        closesAt: "2026-08-21T16:00:00Z",
        status: "closed",
      },
      sprints: [{
        id: "scored",
        name: "Okel",
        placements: [{
          displayName: "Rider",
          userId: "rider",
          place: 1,
          points: 5,
          source: "member",
        }],
      }],
    };
    const futureScheduledDay: CiclaminoSprintDay = {
      ...scoredDay,
      key: "season:2026-10-07",
      sprintDate: "2026-10-07",
      votingWindow: {
        opensAt: "2026-10-07T16:00:00Z",
        closesAt: "2026-10-09T16:00:00Z",
        status: "scheduled",
      },
      sprints: [{ id: "scheduled", name: "Okel", placements: [] }],
    };

    const analysis = buildCiclaminoAnalysis([], [scoredDay, futureScheduledDay]);

    expect(analysis.recentRows).toEqual([
      { displayName: "Rider", points: 5, userId: "rider" },
    ]);
  });
});
