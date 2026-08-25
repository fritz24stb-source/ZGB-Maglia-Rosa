import type { CiclaminoSprintDay } from "@/lib/classifications/types";
import type { Database } from "@/types/database";

type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "display_name" | "id">;
type Season = Pick<Database["public"]["Tables"]["seasons"]["Row"], "id" | "name">;

export function buildCiclaminoSprintDays({
  awards,
  now = new Date(),
  placementOverrides,
  placements,
  profiles,
  seasons,
  sprints,
  votes,
  votingWindows,
}: {
  awards: Database["public"]["Tables"]["ciclamino_combative_awards"]["Row"][];
  now?: Date;
  placementOverrides: Database["public"]["Tables"]["ciclamino_placement_overrides"]["Row"][];
  placements: Database["public"]["Tables"]["ciclamino_placements"]["Row"][];
  profiles: Profile[];
  seasons: Season[];
  sprints: Database["public"]["Tables"]["ciclamino_sprints"]["Row"][];
  votes: Database["public"]["Tables"]["ciclamino_combative_votes"]["Row"][];
  votingWindows: Database["public"]["Tables"]["ciclamino_combative_voting_windows"]["Row"][];
}): CiclaminoSprintDay[] {
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  const seasonNames = new Map(seasons.map((season) => [season.id, season.name]));
  const awardsByDay = new Map(awards.map((award) => [dayKey(award.season_id, award.sprint_date), award]));
  const windowsByDay = new Map(votingWindows.map((window) => [dayKey(window.season_id, window.sprint_date), window]));
  const overrideKeys = new Set(placementOverrides.map((override) =>
    `${dayKey(override.season_id, override.sprint_date)}:${override.location}:${override.place}`,
  ));
  const sprintPoints = new Map<string, number>();
  const sprintById = new Map(sprints.map((sprint) => [sprint.id, sprint]));
  for (const placement of placements) {
    const sprint = sprintById.get(placement.sprint_id);
    if (!sprint) continue;
    const key = `${dayKey(sprint.season_id, sprint.sprint_date)}:${placement.user_id}`;
    sprintPoints.set(key, (sprintPoints.get(key) ?? 0) + placement.points);
  }

  const votesByDay = new Map<string, typeof votes>();
  for (const vote of votes) {
    const key = dayKey(vote.season_id, vote.sprint_date);
    const list = votesByDay.get(key) ?? [];
    list.push(vote);
    votesByDay.set(key, list);
  }

  const days = new Map<string, CiclaminoSprintDay>();
  for (const sprint of sprints) {
    const key = dayKey(sprint.season_id, sprint.sprint_date);
    const day = days.get(key) ?? createDay(key, sprint.season_id, sprint.sprint_date);
    day.sprints.push({
      id: sprint.id,
      name: sprint.name,
      placements: placements
        .filter((placement) => placement.sprint_id === sprint.id)
        .sort((left, right) => left.place - right.place)
        .map((placement) => ({
          displayName: profileNames.get(placement.user_id) ?? "Unbekannt",
          place: placement.place,
          points: placement.points,
          source: overrideKeys.has(`${key}:${sprint.name}:${placement.place}`) ? "admin_override" : "member",
          userId: placement.user_id,
        })),
    });
    days.set(key, day);
  }

  for (const day of days.values()) {
    day.seasonName = seasonNames.get(day.seasonId) ?? "Saison";
    const window = windowsByDay.get(day.key);
    if (window) {
      day.votingWindow = {
        closesAt: window.closes_at,
        opensAt: window.opens_at,
        status: now < new Date(window.opens_at) ? "scheduled" : now < new Date(window.closes_at) ? "open" : "closed",
      };
    }

    const groupedVotes = new Map<string, typeof votes>();
    for (const vote of votesByDay.get(day.key) ?? []) {
      const list = groupedVotes.get(vote.candidate_user_id) ?? [];
      list.push(vote);
      groupedVotes.set(vote.candidate_user_id, list);
    }
    day.voteSummary = [...groupedVotes.entries()]
      .map(([candidateUserId, candidateVotes]) => ({
        candidateDisplayName: profileNames.get(candidateUserId) ?? "Unbekannt",
        candidateUserId,
        sprintPoints: sprintPoints.get(`${day.key}:${candidateUserId}`) ?? 0,
        voteCount: candidateVotes.length,
        voters: candidateVotes.map((vote) => ({
          displayName: profileNames.get(vote.voter_user_id) ?? "Unbekannt",
          userId: vote.voter_user_id,
        })).sort((left, right) => left.displayName.localeCompare(right.displayName, "de")),
      }))
      .sort((left, right) => right.voteCount - left.voteCount || right.sprintPoints - left.sprintPoints || left.candidateDisplayName.localeCompare(right.candidateDisplayName, "de"));

    const override = awardsByDay.get(day.key);
    if (override && day.votingWindow?.status === "closed") {
      day.adminOverrideUserId = override.user_id;
      day.combativeSource = "admin_override";
      day.combativeRider = {
        displayName: profileNames.get(override.user_id) ?? "Unbekannt",
        points: override.points,
        userId: override.user_id,
      };
      continue;
    }

    if (day.votingWindow?.status === "closed" && day.voteSummary.length > 0) {
      const top = day.voteSummary[0];
      const stillTied = day.voteSummary.slice(1).some((candidate) =>
        candidate.voteCount === top.voteCount && candidate.sprintPoints === top.sprintPoints,
      );
      if (!stillTied) {
        day.combativeSource = "vote";
        day.combativeRider = {
          displayName: top.candidateDisplayName,
          points: 5,
          userId: top.candidateUserId,
        };
      }
    }
  }

  return [...days.values()];
}

function createDay(key: string, seasonId: string, sprintDate: string): CiclaminoSprintDay {
  return {
    adminOverrideUserId: null,
    combativeRider: null,
    combativeSource: null,
    key,
    seasonId,
    seasonName: "Saison",
    sprintDate,
    sprints: [],
    voteSummary: [],
    votingWindow: null,
  };
}

function dayKey(seasonId: string, sprintDate: string) {
  return `${seasonId}:${sprintDate}`;
}
