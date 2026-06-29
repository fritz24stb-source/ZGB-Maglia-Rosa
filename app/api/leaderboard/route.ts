import { NextResponse } from "next/server";
import {
  buildLeaderboardResponse,
  normalizeLeaderboardRow,
  parseLeaderboardSearchParams,
  toLeaderboardRpcArgs,
  withEffectiveSeason,
} from "@/lib/leaderboard/query";
import type {
  LeaderboardOption,
  LeaderboardOptions,
  LeaderboardRpcRow,
} from "@/lib/leaderboard/types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type SeasonOptionRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
};

type RuleOptionRow = {
  category: string;
  name: string;
  rule_type: "standard" | "special";
};

type ActivityOptionRow = {
  sport_type: string | null;
};

type LeaderboardRpcClient = {
  rpc(
    functionName: "get_leaderboard",
    args: ReturnType<typeof toLeaderboardRpcArgs>,
  ): Promise<{
    data: LeaderboardRpcRow[] | null;
    error: Error | null;
  }>;
};

const categoryLabels: Record<string, string> = {
  fondo: "Samstags-Fondo",
  zgb_zug: "ZGB Zug",
  scuola: "Scuola",
  scuderia: "Scuderia",
  sonderevent: "Sonderevent",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const query = parseLeaderboardSearchParams(requestUrl.searchParams);
    const supabase = createSupabaseServiceRoleClient();

    const [seasonsResult, rulesResult, activityOptionsResult] =
      await Promise.all([
        supabase
          .from("seasons")
          .select("id, name, starts_on, ends_on, is_active")
          .order("starts_on", { ascending: false }),
        supabase
          .from("scoring_rules")
          .select("category, name, rule_type")
          .eq("is_active", true)
          .order("priority", { ascending: false }),
        supabase
          .from("activities")
          .select("sport_type")
          .eq("status", "active")
          .gt("points", 0)
          .not("matched_rule_id", "is", null)
          .not("sport_type", "is", null)
          .limit(5000),
      ]);

    if (
      seasonsResult.error ||
      rulesResult.error ||
      activityOptionsResult.error
    ) {
      throw (
        seasonsResult.error ?? rulesResult.error ?? activityOptionsResult.error
      );
    }

    const seasons = (seasonsResult.data ?? []) as SeasonOptionRow[];
    const activeSeasonId =
      seasons.find((season) => season.is_active)?.id ?? null;
    const effectiveQuery = withEffectiveSeason(query, activeSeasonId);
    const leaderboardResult = await (
      supabase as unknown as LeaderboardRpcClient
    ).rpc("get_leaderboard", toLeaderboardRpcArgs(effectiveQuery.filters));

    if (leaderboardResult.error) {
      throw leaderboardResult.error;
    }

    const options = buildOptions({
      seasons,
      rules: (rulesResult.data ?? []) as RuleOptionRow[],
      activities: (activityOptionsResult.data ?? []) as ActivityOptionRow[],
    });
    const rows = (leaderboardResult.data ?? []).map(normalizeLeaderboardRow);
    const response = buildLeaderboardResponse({
      rows,
      filters: effectiveQuery.filters,
      options,
      sortKey: effectiveQuery.sortKey,
      sortDirection: effectiveQuery.sortDirection,
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: formatLeaderboardError(error) },
      { status: 500 },
    );
  }
}

function buildOptions(input: {
  seasons: SeasonOptionRow[];
  rules: RuleOptionRow[];
  activities: ActivityOptionRow[];
}): LeaderboardOptions {
  return {
    seasons: input.seasons.map((season) => ({
      value: season.id,
      label: season.name,
      isActive: season.is_active,
      startsOn: season.starts_on,
      endsOn: season.ends_on,
    })),
    categories: buildCategoryOptions(input.rules),
    sources: [
      { value: "strava", label: "Strava" },
      { value: "manual", label: "Manuell" },
    ],
    sportTypes: buildSportTypeOptions(input.activities),
  };
}

function buildCategoryOptions(rules: RuleOptionRow[]): LeaderboardOption[] {
  const options = new Map<string, string>();

  for (const rule of rules) {
    if (options.has(rule.category)) {
      continue;
    }

    options.set(
      rule.category,
      rule.rule_type === "special"
        ? "Sonderevents"
        : (categoryLabels[rule.category] ?? rule.name),
    );
  }

  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "de"));
}

function buildSportTypeOptions(
  activities: ActivityOptionRow[],
): LeaderboardOption[] {
  const sportTypes = new Set<string>();

  for (const activity of activities) {
    if (activity.sport_type) {
      sportTypes.add(activity.sport_type);
    }
  }

  return [...sportTypes]
    .sort((left, right) => left.localeCompare(right, "de"))
    .map((sportType) => ({ value: sportType, label: sportType }));
}

function formatLeaderboardError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return [
      "Supabase ist lokal noch nicht konfiguriert.",
      "Bitte .env.local auf Basis von .env.example setzen.",
    ].join(" ");
  }

  return error instanceof Error
    ? error.message
    : "Leaderboard konnte nicht geladen werden.";
}
