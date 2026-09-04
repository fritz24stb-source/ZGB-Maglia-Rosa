import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

const LOCATIONS = ["Okel", "Heiligenfelde I", "Heiligenfelde II"] as const;
const integrationEnabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const describeDatabase = integrationEnabled ? describe : describe.skip;

type Role = "admin" | "member" | "scorekeeper";
type TestAccount = {
  id: string;
  client: SupabaseClient<Database>;
  email: string;
  role: Role;
};

describeDatabase("classification database integration", () => {
  let service: SupabaseClient<Database>;
  let admin: TestAccount;
  let scorekeeper: TestAccount;
  let members: TestAccount[] = [];
  let seasonId = "";
  let sprintDate = "";
  let seasonStartsOn = "";
  let seasonEndsOn = "";
  const createdAccounts: TestAccount[] = [];
  const runId = crypto.randomUUID().slice(0, 8);

  beforeAll(async () => {
    const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requireEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    const expectedRef = requireEnvironment("EXPECTED_SUPABASE_PROJECT_REF");

    expect(new URL(url).hostname.split(".")[0]).toBe(expectedRef);
    service = createClient<Database>(
      url,
      serviceRoleKey,
      clientOptions(`service-${runId}`),
    );

    admin = await createAccount("admin", "Rennleitung", url, anonKey);
    scorekeeper = await createAccount(
      "scorekeeper",
      "Sprintwertung",
      url,
      anonKey,
    );
    members = [];
    for (let index = 0; index < 5; index += 1) {
      members.push(
        await createAccount("member", `Fahrer ${index + 1}`, url, anonKey),
      );
    }

    sprintDate = currentBerlinWednesday();
    seasonStartsOn = addDays(sprintDate, -14);
    seasonEndsOn = addDays(sprintDate, 14);
    const { data: season, error } = await service
      .from("seasons")
      .insert({
        name: `Codex Klassifikationstest ${runId}`,
        starts_on: seasonStartsOn,
        ends_on: seasonEndsOn,
        is_active: false,
      })
      .select("id")
      .single();
    if (error) throw error;
    seasonId = season.id;

    async function createAccount(
      role: Role,
      label: string,
      url: string,
      anonKey: string,
    ) {
      const email = `codex-classifications-${runId}-${createdAccounts.length}@example.invalid`;
      const password = `Zgb-${runId}-${createdAccounts.length}-Test!`;
      const { data: created, error: createError } =
        await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (createError) throw createError;

      const { error: profileError } = await service.from("profiles").insert({
        id: created.user.id,
        display_name: `${label} ${runId}`,
        role,
        is_active: true,
      });
      if (profileError) throw profileError;

      const client = createClient<Database>(
        url,
        anonKey,
        clientOptions(`auth-${created.user.id}`),
      );
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      const account = { id: created.user.id, client, email, role };
      createdAccounts.push(account);
      return account;
    }
  }, 120_000);

  afterAll(async () => {
    if (!service) return;
    if (seasonId) {
      await service.from("activities").delete().eq("season_id", seasonId);
      await service.from("seasons").delete().eq("id", seasonId);
    }
    for (const account of createdAccounts.reverse()) {
      await service.auth.admin.deleteUser(account.id);
    }
  }, 120_000);

  it("creates every season Wednesday with all three sprint locations", async () => {
    const expectedWednesdays = datesBetween(
      seasonStartsOn,
      seasonEndsOn,
    ).filter((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 3);
    const { data: windows, error: windowError } = await service
      .from("ciclamino_combative_voting_windows")
      .select("sprint_date")
      .eq("season_id", seasonId)
      .order("sprint_date");
    if (windowError) throw windowError;
    expect(windows.map((row) => row.sprint_date)).toEqual(expectedWednesdays);

    const { data: sprints, error: sprintError } = await service
      .from("ciclamino_sprints")
      .select("sprint_date, name")
      .eq("season_id", seasonId);
    if (sprintError) throw sprintError;
    for (const date of expectedWednesdays) {
      expect(
        sprints
          .filter((row) => row.sprint_date === date)
          .map((row) => row.name)
          .sort(),
      ).toEqual([...LOCATIONS].sort());
    }
  });

  it("allows admin and scorekeeper sprint changes but blocks members", async () => {
    const testDate = addDays(sprintDate, 7);
    const memberAttempt = await members[0].client
      .from("ciclamino_sprints")
      .update({ created_by: members[0].id })
      .eq("season_id", seasonId)
      .eq("sprint_date", testDate)
      .eq("name", "Okel")
      .select("id");
    expect(memberAttempt.error).toBeNull();
    expect(memberAttempt.data).toHaveLength(0);

    for (const manager of [scorekeeper, admin]) {
      const updated = await manager.client
        .from("ciclamino_sprints")
        .update({ created_by: manager.id })
        .eq("season_id", seasonId)
        .eq("sprint_date", testDate)
        .eq("name", "Okel")
        .select("id");
      expect(updated.error).toBeNull();
      expect(updated.data).toHaveLength(1);
    }
  });

  it("enforces unique self-reported places and scores 5/4/3/2/1", async () => {
    const now = Date.now();
    const { error: windowError } = await service
      .from("ciclamino_combative_voting_windows")
      .update({
        opens_at: new Date(now - 3_600_000).toISOString(),
        closes_at: new Date(now + 3_600_000).toISOString(),
      })
      .eq("season_id", seasonId)
      .eq("sprint_date", sprintDate);
    if (windowError) throw windowError;

    await submitVote(members[0], 1, members[0].id);
    const duplicate = await service.rpc("save_ciclamino_member_vote", {
      p_season_id: seasonId,
      p_sprint_date: sprintDate,
      p_voter_user_id: members[1].id,
      p_candidate_user_id: members[0].id,
      p_results: LOCATIONS.map((location) => ({ location, place: 1 })),
    });
    expect(duplicate.error).not.toBeNull();

    const candidates = [
      members[0].id,
      members[0].id,
      members[1].id,
      members[1].id,
      members[2].id,
    ];
    for (let index = 1; index < members.length; index += 1) {
      await submitVote(members[index], index + 1, candidates[index]);
    }

    const { data: sprintRows, error: sprintError } = await service
      .from("ciclamino_sprints")
      .select("id, name")
      .eq("season_id", seasonId)
      .eq("sprint_date", sprintDate);
    if (sprintError) throw sprintError;
    const { data: placements, error } = await service
      .from("ciclamino_placements")
      .select("sprint_id, place, points")
      .in(
        "sprint_id",
        sprintRows.map((row) => row.id),
      )
      .order("place");
    if (error) throw error;
    for (const location of LOCATIONS) {
      expect(
        placements
          .filter(
            (row) =>
              row.sprint_id ===
              sprintRows.find((sprint) => sprint.name === location)?.id,
          )
          .map((row) => row.points),
      ).toEqual([5, 4, 3, 2, 1]);
    }

    const openLeaderboard = await ciclaminoLeaderboard();
    expect(
      openLeaderboard.find((row) => row.user_id === members[0].id),
    ).toMatchObject({
      total_points: 15,
      combative_awards: 0,
    });

    async function submitVote(
      voter: TestAccount,
      place: number,
      candidateUserId: string,
    ) {
      const { error: voteError } = await service.rpc(
        "save_ciclamino_member_vote",
        {
          p_season_id: seasonId,
          p_sprint_date: sprintDate,
          p_voter_user_id: voter.id,
          p_candidate_user_id: candidateUserId,
          p_results: LOCATIONS.map((location) => ({ location, place })),
        },
      );
      if (voteError) throw voteError;
    }
  }, 60_000);

  it("resolves a vote tie by sprint points after the voting window closes", async () => {
    const now = Date.now();
    const { error } = await service
      .from("ciclamino_combative_voting_windows")
      .update({
        opens_at: new Date(now - 7_200_000).toISOString(),
        closes_at: new Date(now - 3_600_000).toISOString(),
      })
      .eq("season_id", seasonId)
      .eq("sprint_date", sprintDate);
    if (error) throw error;

    const leaderboard = await ciclaminoLeaderboard();
    expect(leaderboard[0]).toMatchObject({
      user_id: members[0].id,
      total_points: 20,
      combative_awards: 1,
    });
  });

  it("applies placement and Most-Combative admin overrides", async () => {
    const window = {
      opensAt: new Date(Date.now() - 7_200_000).toISOString(),
      closesAt: new Date(Date.now() - 3_600_000).toISOString(),
    };
    const { error } = await service.rpc("save_ciclamino_race_day", {
      p_season_id: seasonId,
      p_sprint_date: sprintDate,
      p_sprints: LOCATIONS.map((name) => ({
        name,
        userIds:
          name === "Okel"
            ? [
                members[1].id,
                members[0].id,
                members[2].id,
                members[3].id,
                members[4].id,
              ]
            : [null, null, null, null, null],
      })),
      p_combative_user_id: members[1].id,
      p_actor_user_id: admin.id,
      p_original_season_id: seasonId,
      p_original_sprint_date: sprintDate,
      p_vote_opens_at: window.opensAt,
      p_vote_closes_at: window.closesAt,
    });
    if (error) throw error;

    const { data: okelSprint, error: sprintError } = await service
      .from("ciclamino_sprints")
      .select("id")
      .eq("season_id", seasonId)
      .eq("sprint_date", sprintDate)
      .eq("name", "Okel")
      .single();
    if (sprintError) throw sprintError;
    const { data: okel, error: placementError } = await service
      .from("ciclamino_placements")
      .select("place, user_id")
      .eq("sprint_id", okelSprint.id)
      .order("place");
    if (placementError) throw placementError;
    expect(okel[0]).toMatchObject({ place: 1, user_id: members[1].id });

    const leaderboard = await ciclaminoLeaderboard();
    expect(leaderboard[0]).toMatchObject({
      user_id: members[1].id,
      combative_awards: 1,
    });
  });

  it("enforces one Azzurra week, supports admin reset, and filters rides", async () => {
    const startsOn = sprintDate;
    for (const member of members.slice(0, 2)) {
      const inserted = await member.client.from("azzurra_windows").insert({
        user_id: member.id,
        season_id: seasonId,
        starts_on: startsOn,
        selected_by: member.id,
      });
      expect(inserted.error).toBeNull();
    }

    const duplicate = await members[0].client.from("azzurra_windows").insert({
      user_id: members[0].id,
      season_id: seasonId,
      starts_on: addDays(startsOn, 1),
      selected_by: members[0].id,
    });
    expect(duplicate.error).not.toBeNull();

    const scorekeeperDelete = await scorekeeper.client
      .from("azzurra_windows")
      .delete()
      .eq("user_id", members[0].id)
      .eq("season_id", seasonId)
      .select("user_id");
    expect(scorekeeperDelete.error).toBeNull();
    expect(scorekeeperDelete.data).toHaveLength(0);

    const adminDelete = await admin.client
      .from("azzurra_windows")
      .delete()
      .eq("user_id", members[0].id)
      .eq("season_id", seasonId)
      .select("user_id");
    expect(adminDelete.error).toBeNull();
    expect(adminDelete.data).toHaveLength(1);

    const reinserted = await members[0].client.from("azzurra_windows").insert({
      user_id: members[0].id,
      season_id: seasonId,
      starts_on: startsOn,
      selected_by: members[0].id,
    });
    expect(reinserted.error).toBeNull();

    const activities = [
      activity(
        members[0].id,
        "Ride",
        100,
        10_000,
        `${startsOn}T00:15:00+02:00`,
        1,
      ),
      activity(
        members[0].id,
        "GravelRide",
        200,
        10_000,
        `${addDays(startsOn, 3)}T12:00:00+02:00`,
        2,
      ),
      activity(
        members[0].id,
        "MountainBikeRide",
        300,
        10_000,
        `${addDays(startsOn, 6)}T23:45:00+02:00`,
        3,
      ),
      activity(
        members[0].id,
        "Run",
        1_000,
        50_000,
        `${addDays(startsOn, 2)}T12:00:00+02:00`,
        4,
      ),
      activity(
        members[0].id,
        "Ride",
        1_000,
        50_000,
        `${addDays(startsOn, 7)}T00:15:00+02:00`,
        5,
      ),
      activity(
        members[1].id,
        "Ride",
        600,
        40_000,
        `${addDays(startsOn, 2)}T12:00:00+02:00`,
        6,
      ),
    ];
    const { error: activityError } = await service
      .from("activities")
      .insert(activities);
    if (activityError) throw activityError;

    const { data, error: leaderboardError } = await service.rpc(
      "get_azzurra_leaderboard",
      { p_season_id: seasonId },
    );
    if (leaderboardError) throw leaderboardError;
    expect(data[0]).toMatchObject({
      place: 1,
      user_id: members[1].id,
      total_elevation_gain_m: 600,
      total_distance_m: 40_000,
      ride_count: 1,
    });
    expect(data[1]).toMatchObject({
      place: 2,
      user_id: members[0].id,
      total_elevation_gain_m: 600,
      total_distance_m: 30_000,
      ride_count: 3,
    });
  }, 60_000);

  async function ciclaminoLeaderboard() {
    const { data, error } = await service.rpc("get_ciclamino_leaderboard", {
      p_season_id: seasonId,
    });
    if (error) throw error;
    return data;
  }

  function activity(
    userId: string,
    sportType: string,
    elevation: number,
    distance: number,
    startedAt: string,
    sequence: number,
  ) {
    return {
      user_id: userId,
      season_id: seasonId,
      strava_activity_id: Date.now() + sequence * 10_000,
      source: "strava" as const,
      activity_name: `DB test ${sequence}`,
      sport_type: sportType,
      distance_m: distance,
      total_elevation_gain_m: elevation,
      activity_started_at: startedAt,
      activity_started_local_at: startedAt,
      points: 0,
      awarded_points: 0,
      status: "active" as const,
      manually_entered: false,
    };
  }
});

function clientOptions(storageKey: string) {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey,
    },
  };
}

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function currentBerlinWednesday() {
  const berlinDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(`${berlinDate}T12:00:00Z`);
  const daysSinceWednesday = (date.getUTCDay() + 4) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceWednesday);
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesBetween(startsOn: string, endsOn: string) {
  const dates: string[] = [];
  for (let value = startsOn; value <= endsOn; value = addDays(value, 1)) {
    dates.push(value);
  }
  return dates;
}
