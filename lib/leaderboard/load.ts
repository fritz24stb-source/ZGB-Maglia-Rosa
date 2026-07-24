import {
  buildLeaderboardResponse,
  normalizeLeaderboardRow,
  parseLeaderboardSearchParams,
  withEffectiveSeason,
} from "@/lib/leaderboard/query";
import type {
  LeaderboardFilters,
  LeaderboardOption,
  LeaderboardOptions,
  LeaderboardResponse,
  LeaderboardRpcRow,
} from "@/lib/leaderboard/types";

export type LeaderboardSeasonRecord = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
};

export type LeaderboardRuleRecord = {
  category: string;
  name: string;
  rule_type: "standard" | "special";
};

export type LeaderboardDataSource = {
  loadSeasons: () => Promise<LeaderboardSeasonRecord[]>;
  loadRules: () => Promise<LeaderboardRuleRecord[]>;
  loadRows: (filters: LeaderboardFilters) => Promise<LeaderboardRpcRow[]>;
};

const categoryLabels: Record<string, string> = {
  fondo: "Samstags-Fondo",
  zug: "Zug",
  scuola: "Scuola",
  scuderia: "Scuderia",
  sonderevent: "Sonderevent",
};

export async function loadLeaderboardData(
  searchParams: URLSearchParams,
  dataSource: LeaderboardDataSource,
): Promise<LeaderboardResponse> {
  const query = parseLeaderboardSearchParams(searchParams);
  const [seasons, rules] = await Promise.all([
    dataSource.loadSeasons(),
    dataSource.loadRules(),
  ]);
  const activeSeasonId = seasons.find((season) => season.is_active)?.id ?? null;
  const effectiveQuery = withEffectiveSeason(query, activeSeasonId);
  const rows = await dataSource.loadRows(effectiveQuery.filters);

  return buildLeaderboardResponse({
    rows: rows.map(normalizeLeaderboardRow),
    filters: effectiveQuery.filters,
    options: buildOptions({ seasons, rules }),
    sortKey: effectiveQuery.sortKey,
    sortDirection: effectiveQuery.sortDirection,
  });
}

function buildOptions(input: {
  seasons: LeaderboardSeasonRecord[];
  rules: LeaderboardRuleRecord[];
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
  };
}

function buildCategoryOptions(
  rules: LeaderboardRuleRecord[],
): LeaderboardOption[] {
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
