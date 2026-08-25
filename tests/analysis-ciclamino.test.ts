import { describe, expect, it } from "vitest";
import { buildCiclaminoAnalysis } from "@/lib/analysis/ciclamino";

describe("ciclamino analysis", () => {
  it("summarizes placements independently of an open voting window", () => {
    const analysis = buildCiclaminoAnalysis([{
      place: 1, userId: "rider", displayName: "Rider", seasonId: "season", seasonName: "Saison", totalPoints: 11, wins: 1, secondPlaces: 1, thirdPlaces: 0, fourthPlaces: 0, fifthPlaces: 0, combativeAwards: 0, sprintCount: 2,
    }], [{ key: "season:2026-08-19", seasonId: "season", seasonName: "Saison", sprintDate: "2026-08-19", adminOverrideUserId: null, combativeRider: null, combativeSource: null, voteSummary: [], votingWindow: { opensAt: "2026-08-19T16:00:00Z", closesAt: "2026-08-21T16:00:00Z", status: "open" }, sprints: [{ id: "sprint", name: "Okel", placements: [{ displayName: "Rider", userId: "rider", place: 1, points: 5, source: "member" }] }] }]);
    expect(analysis.summary).toMatchObject({ sprintDays: 1, completedDays: 0, awardedPoints: 5 });
    expect(analysis.rows[0]).toMatchObject({ podiums: 2, averagePoints: 5.5 });
  });
});
