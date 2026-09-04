import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { buildCiclaminoSprintDays } from "@/lib/classifications/ciclamino-days";
import type {
  AzzurraLeaderboardRow,
  CiclaminoLeaderboardRow,
  ClassificationLeaderboardResponse,
  ClassificationSeason,
} from "@/lib/classifications/types";
import type { Database } from "@/types/database";

type CiclaminoRpcRow =
  Database["public"]["Functions"]["get_ciclamino_leaderboard"]["Returns"][number];
type AzzurraRpcRow =
  Database["public"]["Functions"]["get_azzurra_leaderboard"]["Returns"][number];

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
  const [ciclaminoResult, azzurraResult, sprintsResult, placementsResult, awardsResult, windowsResult, votesResult, overridesResult, profilesResult] = await Promise.all([
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
    selectedSeasonId
      ? supabase.from("ciclamino_combative_voting_windows").select("*").eq("season_id", selectedSeasonId)
      : Promise.resolve({ data: [], error: null }),
    selectedSeasonId
      ? supabase.from("ciclamino_combative_votes").select("*").eq("season_id", selectedSeasonId)
      : Promise.resolve({ data: [], error: null }),
    selectedSeasonId
      ? supabase.from("ciclamino_placement_overrides").select("*").eq("season_id", selectedSeasonId)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select("id, display_name").eq("is_active", true),
  ]);

  const error = ciclaminoResult.error ?? azzurraResult.error ?? sprintsResult.error ?? placementsResult.error ?? awardsResult.error ?? windowsResult.error ?? votesResult.error ?? overridesResult.error ?? profilesResult.error;
  if (error) {
    throw error;
  }

  const ciclaminoSprintDays = buildCiclaminoSprintDays({
    awards: awardsResult.data ?? [],
    placementOverrides: overridesResult.data ?? [],
    placements: placementsResult.data ?? [],
    profiles: profilesResult.data ?? [],
    seasons,
    sprints: sprintsResult.data ?? [],
    votes: votesResult.data ?? [],
    votingWindows: windowsResult.data ?? [],
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
