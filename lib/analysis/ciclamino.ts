import type { CiclaminoLeaderboardRow, CiclaminoSprintDay } from "@/lib/classifications/types";

export type CiclaminoAnalysisRow = CiclaminoLeaderboardRow & {
  averagePoints: number;
  podiums: number;
};

export type CiclaminoAnalysis = {
  rows: CiclaminoAnalysisRow[];
  summary: {
    awardedPoints: number;
    completedDays: number;
    participatingRiders: number;
    sprintDays: number;
  };
  trend: { date: string; totalPoints: number }[];
};

export function buildCiclaminoAnalysis(
  leaderboard: CiclaminoLeaderboardRow[],
  sprintDays: CiclaminoSprintDay[],
): CiclaminoAnalysis {
  const rows = leaderboard.map((row) => ({
    ...row,
    averagePoints: row.sprintCount ? row.totalPoints / row.sprintCount : 0,
    podiums: row.wins + row.secondPlaces + row.thirdPlaces,
  }));
  const trend = [...sprintDays]
    .sort((left, right) => left.sprintDate.localeCompare(right.sprintDate))
    .map((day) => ({
      date: day.sprintDate,
      totalPoints: day.sprints.flatMap((sprint) => sprint.placements)
        .reduce((sum, placement) => sum + placement.points, 0),
    }));

  return {
    rows,
    summary: {
      awardedPoints: trend.reduce((sum, day) => sum + day.totalPoints, 0),
      completedDays: sprintDays.filter((day) => day.votingWindow?.status === "closed").length,
      participatingRiders: rows.length,
      sprintDays: sprintDays.length,
    },
    trend,
  };
}
