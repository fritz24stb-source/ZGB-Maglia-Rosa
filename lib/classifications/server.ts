import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
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
  const [ciclaminoResult, azzurraResult] = await Promise.all([
    supabase.rpc("get_ciclamino_leaderboard", {
      p_season_id: selectedSeasonId,
    }),
    supabase.rpc("get_azzurra_leaderboard", {
      p_season_id: selectedSeasonId,
    }),
  ]);

  if (ciclaminoResult.error || azzurraResult.error) {
    throw ciclaminoResult.error ?? azzurraResult.error;
  }

  return {
    seasons,
    selectedSeasonId,
    ciclamino: ((ciclaminoResult.data ?? []) as CiclaminoRpcRow[]).map(
      normalizeCiclaminoRow,
    ),
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
