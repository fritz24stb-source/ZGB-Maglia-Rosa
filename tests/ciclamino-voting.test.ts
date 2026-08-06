import { describe, expect, it } from "vitest";
import { buildCiclaminoSprintDays } from "@/lib/classifications/ciclamino-days";
import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];

const season = { id: "season", name: "Saison" };
const profiles = [
  { id: "candidate-a", display_name: "A" },
  { id: "candidate-b", display_name: "B" },
  { id: "voter-a", display_name: "Voter A" },
  { id: "voter-b", display_name: "Voter B" },
];
const sprints = [{
  id: "sprint",
  season_id: "season",
  sprint_date: "2026-08-05",
  name: "Okel",
  created_by: null,
  created_at: "2026-08-05T16:00:00Z",
  updated_at: "2026-08-05T16:00:00Z",
}] satisfies Tables["ciclamino_sprints"]["Row"][];
const votingWindows = [{
  season_id: "season",
  sprint_date: "2026-08-05",
  opens_at: "2026-08-05T16:00:00Z",
  closes_at: "2026-08-06T16:00:00Z",
  updated_by: null,
  created_at: "2026-08-05T16:00:00Z",
  updated_at: "2026-08-05T16:00:00Z",
}] satisfies Tables["ciclamino_combative_voting_windows"]["Row"][];
const votes = [
  vote("voter-a", "candidate-a"),
  vote("voter-b", "candidate-b"),
];

describe("Most Combative voting", () => {
  it("uses sprint points to resolve equal vote counts", () => {
    const days = buildCiclaminoSprintDays({
      awards: [],
      now: new Date("2026-08-06T17:00:00Z"),
      placements: [placement("candidate-a", 1, 5), placement("candidate-b", 2, 4)],
      profiles,
      seasons: [season],
      sprints,
      votes,
      votingWindows,
    });
    expect(days[0].combativeRider?.userId).toBe("candidate-a");
    expect(days[0].combativeSource).toBe("vote");
  });

  it("requires an override when votes and sprint points remain tied", () => {
    const days = buildCiclaminoSprintDays({
      awards: [],
      now: new Date("2026-08-06T17:00:00Z"),
      placements: [placement("candidate-a", 1, 5), placement("candidate-b", 1, 5)],
      profiles,
      seasons: [season],
      sprints,
      votes,
      votingWindows,
    });
    expect(days[0].combativeRider).toBeNull();
  });

  it("lets the admin override win over the ballot", () => {
    const days = buildCiclaminoSprintDays({
      awards: [{
        season_id: "season",
        sprint_date: "2026-08-05",
        user_id: "candidate-b",
        points: 5,
        awarded_by: "voter-a",
        created_at: "2026-08-05T16:00:00Z",
        updated_at: "2026-08-05T16:00:00Z",
      }],
      now: new Date("2026-08-06T17:00:00Z"),
      placements: [placement("candidate-a", 1, 5), placement("candidate-b", 2, 4)],
      profiles,
      seasons: [season],
      sprints,
      votes,
      votingWindows,
    });
    expect(days[0].combativeRider?.userId).toBe("candidate-b");
    expect(days[0].combativeSource).toBe("admin_override");
  });
});

function vote(voter: string, candidate: string): Tables["ciclamino_combative_votes"]["Row"] {
  return { season_id: "season", sprint_date: "2026-08-05", voter_user_id: voter, candidate_user_id: candidate, created_at: "2026-08-05T16:00:00Z", updated_at: "2026-08-05T16:00:00Z" };
}
function placement(userId: string, place: number, points: number): Tables["ciclamino_placements"]["Row"] {
  return { sprint_id: "sprint", user_id: userId, place, points, created_at: "2026-08-05T16:00:00Z" };
}
