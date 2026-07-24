import "server-only";

import {
  loadLeaderboardData,
  type LeaderboardDataSource,
  type LeaderboardRuleRecord,
  type LeaderboardSeasonRecord,
} from "@/lib/leaderboard/load";
import { toLeaderboardRpcArgs } from "@/lib/leaderboard/query";
import type {
  LeaderboardResponse,
  LeaderboardRpcRow,
} from "@/lib/leaderboard/types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type LeaderboardRpcClient = {
  rpc(
    functionName: "get_leaderboard",
    args: ReturnType<typeof toLeaderboardRpcArgs>,
  ): Promise<{
    data: LeaderboardRpcRow[] | null;
    error: Error | null;
  }>;
};

export async function loadLeaderboardResponse(
  searchParams: URLSearchParams,
): Promise<LeaderboardResponse> {
  const supabase = createSupabaseServiceRoleClient();
  const dataSource: LeaderboardDataSource = {
    async loadSeasons() {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, starts_on, ends_on, is_active")
        .order("starts_on", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as LeaderboardSeasonRecord[];
    },
    async loadRules() {
      const { data, error } = await supabase
        .from("scoring_rules")
        .select("category, name, rule_type")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as LeaderboardRuleRecord[];
    },
    async loadRows(filters) {
      const { data, error } = await (
        supabase as unknown as LeaderboardRpcClient
      ).rpc("get_leaderboard", toLeaderboardRpcArgs(filters));

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  };

  return loadLeaderboardData(searchParams, dataSource);
}
