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
  finishLeaders: { place: number; count: number; names: string[] }[];
  recentRows: { displayName: string; points: number; userId: string }[];
  trend: { date: string; values: { displayName: string; totalPoints: number; userId: string }[] }[];
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
  const sortedDays = [...sprintDays].sort((left, right) => left.sprintDate.localeCompare(right.sprintDate));
  const totals = new Map<string, number>();
  const names = new Map(rows.map((row) => [row.userId, row.displayName]));
  const trend = sortedDays.map((day) => {
    for (const placement of day.sprints.flatMap((sprint) => sprint.placements)) {
      names.set(placement.userId, placement.displayName);
      totals.set(placement.userId, (totals.get(placement.userId) ?? 0) + placement.points);
    }
    if (day.votingWindow?.status === "closed" && day.combativeRider) totals.set(day.combativeRider.userId, (totals.get(day.combativeRider.userId) ?? 0) + day.combativeRider.points);
    return { date: day.sprintDate, values: [...totals.entries()].map(([userId, totalPoints]) => ({ displayName: names.get(userId) ?? "Unbekannt", totalPoints, userId })) };
  });
  // Sprint days are scheduled for the complete season in advance. Anchor the
  // recent window at the latest day with awarded points so future empty days
  // cannot move already recorded results out of the three-week comparison.
  const latestScoredDay = sortedDays.findLast((day) =>
    day.sprints.some((sprint) => sprint.placements.length > 0)
      || (day.votingWindow?.status === "closed" && day.combativeRider !== null),
  );
  const cutoff = latestScoredDay ? new Date(`${latestScoredDay.sprintDate}T12:00:00Z`) : null;
  if (cutoff) cutoff.setUTCDate(cutoff.getUTCDate() - 20);
  const recentTotals = new Map<string, number>();
  for (const day of sortedDays) {
    if (cutoff && new Date(`${day.sprintDate}T12:00:00Z`) < cutoff) continue;
    for (const placement of day.sprints.flatMap((sprint) => sprint.placements)) recentTotals.set(placement.userId, (recentTotals.get(placement.userId) ?? 0) + placement.points);
    if (day.votingWindow?.status === "closed" && day.combativeRider) recentTotals.set(day.combativeRider.userId, (recentTotals.get(day.combativeRider.userId) ?? 0) + day.combativeRider.points);
  }
  const recentRows = [...recentTotals.entries()].map(([userId, points]) => ({ displayName: names.get(userId) ?? "Unbekannt", points, userId })).sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName, "de"));
  const finishLeaders = [1, 2, 3, 4, 5].map((place) => {
    const key = place === 1 ? "wins" : place === 2 ? "secondPlaces" : place === 3 ? "thirdPlaces" : place === 4 ? "fourthPlaces" : "fifthPlaces";
    const count = Math.max(0, ...rows.map((row) => row[key]));
    return { place, count, names: count ? rows.filter((row) => row[key] === count).map((row) => row.displayName) : [] };
  });

  return {
    rows,
    summary: {
      awardedPoints: [...totals.values()].reduce((sum, value) => sum + value, 0),
      completedDays: sprintDays.filter((day) => day.votingWindow?.status === "closed").length,
      participatingRiders: rows.length,
      sprintDays: sprintDays.length,
    },
    finishLeaders,
    recentRows,
    trend,
  };
}
