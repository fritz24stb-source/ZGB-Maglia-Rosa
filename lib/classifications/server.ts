import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  AzzurraLeaderboardRow,
  CiclaminoLeaderboardRow,
  CiclaminoSprintDay,
  ClassificationLeaderboardResponse,
  ClassificationSeason,
} from "@/lib/classifications/types";
import type { Database } from "@/types/database";

type CiclaminoRpcRow =
  Database["public"]["Functions"]["get_ciclamino_leaderboard"]["Returns"][number];
type AzzurraRpcRow =
  Database["public"]["Functions"]["get_azzurra_leaderboard"]["Returns"][number];

export function classificationsEnabled() {
  return process.env.CLASSIFICATIONS_ENABLED !== "false";
}

export async function loadClassificationLeaderboard(
  requestedSeasonId?: string | null,
): Promise<ClassificationLeaderboardResponse> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: seasonData, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name, starts_on, ends_on, is_active")
    .order("starts_on", { ascending: false });

  if (seasonError) {
    throw seasonError;
  }

  const seasons: ClassificationSeason[] = (seasonData ?? []).map((season) => ({
    id: season.id,
    name: season.name,
    isActive: season.is_active,
    startsOn: season.starts_on,
    endsOn: season.ends_on,
  }));
  const selectedSeasonId = resolveSeasonId(requestedSeasonId, seasons);
  const [ciclaminoResult, azzurraResult, sprintsResult, placementsResult, awardsResult] = await Promise.all([
    supabase.rpc("get_ciclamino_leaderboard", {
      p_season_id: selectedSeasonId,
    }),
    supabase.rpc("get_azzurra_leaderboard", {
      p_season_id: selectedSeasonId,
    }),
    selectedSeasonId
      ? supabase.from("ciclamino_sprints").select("*").eq("season_id", selectedSeasonId).order("sprint_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("ciclamino_placements").select("*"),
    selectedSeasonId
      ? supabase.from("ciclamino_combative_awards").select("*").eq("season_id", selectedSeasonId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = ciclaminoResult.error ?? azzurraResult.error ?? sprintsResult.error ?? placementsResult.error ?? awardsResult.error;
  if (error) {
    throw error;
  }

  const profileNames = new Map<string, string>();
  const selectedSprintIds = new Set((sprintsResult.data ?? []).map((sprint) => sprint.id));
  const relevantUserIds = new Set<string>();
  for (const placement of placementsResult.data ?? []) {
    if (selectedSprintIds.has(placement.sprint_id)) relevantUserIds.add(placement.user_id);
  }
  for (const award of awardsResult.data ?? []) relevantUserIds.add(award.user_id);
  const { data: profileData, error: profileError } = relevantUserIds.size
    ? await supabase.from("profiles").select("id, display_name").in("id", [...relevantUserIds])
    : { data: [], error: null };
  if (profileError) throw profileError;
  for (const profile of profileData ?? []) profileNames.set(profile.id, profile.display_name);
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);
  const ciclaminoSprintDays = normalizeSprintDays({
    awards: awardsResult.data ?? [],
    placements: placementsResult.data ?? [],
    profileNames,
    seasonName: selectedSeason?.name ?? "Saison",
    sprints: sprintsResult.data ?? [],
  });

  return {
    seasons,
    selectedSeasonId,
    ciclamino: ((ciclaminoResult.data ?? []) as CiclaminoRpcRow[]).map(
      normalizeCiclaminoRow,
    ),
    ciclaminoSprintDays,
    azzurra: ((azzurraResult.data ?? []) as AzzurraRpcRow[]).map(
      normalizeAzzurraRow,
    ),
  };
}

function resolveSeasonId(
  requestedSeasonId: string | null | undefined,
  seasons: ClassificationSeason[],
) {
  if (
    requestedSeasonId &&
    seasons.some((season) => season.id === requestedSeasonId)
  ) {
    return requestedSeasonId;
  }

  return seasons.find((season) => season.isActive)?.id ?? seasons[0]?.id ?? null;
}

function normalizeCiclaminoRow(row: CiclaminoRpcRow): CiclaminoLeaderboardRow {
  return {
    place: Number(row.place),
    userId: row.user_id,
    displayName: row.display_name,
    seasonId: row.season_id,
    seasonName: row.season_name,
    totalPoints: Number(row.total_points),
    wins: Number(row.wins),
    secondPlaces: Number(row.second_places),
    thirdPlaces: Number(row.third_places),
    fourthPlaces: Number(row.fourth_places),
    fifthPlaces: Number(row.fifth_places),
    combativeAwards: Number(row.combative_awards),
    sprintCount: Number(row.sprint_count),
  };
}

function normalizeSprintDays({ awards, placements, profileNames, seasonName, sprints }: {
  awards: Database["public"]["Tables"]["ciclamino_combative_awards"]["Row"][];
  placements: Database["public"]["Tables"]["ciclamino_placements"]["Row"][];
  profileNames: Map<string, string>;
  seasonName: string;
  sprints: Database["public"]["Tables"]["ciclamino_sprints"]["Row"][];
}): CiclaminoSprintDay[] {
  const awardsByDay = new Map(awards.map((award) => [`${award.season_id}:${award.sprint_date}`, award]));
  const days = new Map<string, CiclaminoSprintDay>();
  for (const sprint of sprints) {
    const key = `${sprint.season_id}:${sprint.sprint_date}`;
    const award = awardsByDay.get(key);
    const day = days.get(key) ?? {
      combativeRider: award ? {
        displayName: profileNames.get(award.user_id) ?? "Unbekannt",
        points: award.points,
        userId: award.user_id,
      } : null,
      key,
      seasonId: sprint.season_id,
      seasonName,
      sprintDate: sprint.sprint_date,
      sprints: [],
    };
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
          userId: placement.user_id,
        })),
    });
    days.set(key, day);
  }
  return [...days.values()];
}

function normalizeAzzurraRow(row: AzzurraRpcRow): AzzurraLeaderboardRow {
  return {
    place: Number(row.place),
    userId: row.user_id,
    displayName: row.display_name,
    seasonId: row.season_id,
    seasonName: row.season_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    totalElevationGainM: Number(row.total_elevation_gain_m),
    totalDistanceM: Number(row.total_distance_m),
    rideCount: Number(row.ride_count),
    missingElevationCount: Number(row.missing_elevation_count),
  };
}
