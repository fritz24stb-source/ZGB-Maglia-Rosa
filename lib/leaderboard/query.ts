import type { Database } from "@/types/database";
import type {
  LeaderboardFilters,
  LeaderboardQuery,
  LeaderboardResponse,
  LeaderboardRpcRow,
  LeaderboardRow,
  LeaderboardSortDirection,
  LeaderboardSortKey,
} from "@/lib/leaderboard/types";

type LeaderboardRpcArgs =
  Database["public"]["Functions"]["get_leaderboard"]["Args"];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sortKeys = new Set<LeaderboardSortKey>([
  "place",
  "displayName",
  "totalPoints",
  "totalRides",
  "samstagsFahrten",
  "mittwochsFahrten",
  "sonderevents",
  "manualPoints",
  "lastActivityAt",
]);

const defaultQuery: LeaderboardQuery = {
  filters: {
    seasonId: null,
    category: null,
    source: null,
    from: null,
    to: null,
    memberId: null,
    sportType: null,
  },
  sortKey: "totalPoints",
  sortDirection: "desc",
  useActiveSeasonDefault: true,
};

export function parseLeaderboardSearchParams(
  searchParams: URLSearchParams,
): LeaderboardQuery {
  const seasonIdParam = searchParams.get("seasonId");

  return {
    filters: {
      seasonId: parseUuidFilter(seasonIdParam),
      category: parseTextFilter(searchParams.get("category")),
      source: parseSourceFilter(searchParams.get("source")),
      from: parseDateFilter(searchParams.get("from")),
      to: parseDateFilter(searchParams.get("to")),
      memberId: parseUuidFilter(searchParams.get("memberId")),
      sportType: parseTextFilter(searchParams.get("sportType")),
    },
    sortKey: parseSortKey(searchParams.get("sort")),
    sortDirection: parseSortDirection(searchParams.get("direction")),
    useActiveSeasonDefault: seasonIdParam === null,
  };
}

export function withEffectiveSeason(
  query: LeaderboardQuery,
  activeSeasonId: string | null,
): LeaderboardQuery {
  if (!query.useActiveSeasonDefault || query.filters.seasonId) {
    return query;
  }

  return {
    ...query,
    filters: {
      ...query.filters,
      seasonId: activeSeasonId,
    },
  };
}

export function toLeaderboardRpcArgs(
  filters: LeaderboardFilters,
): LeaderboardRpcArgs {
  return {
    p_season_id: filters.seasonId,
    p_category: filters.category,
    p_source: filters.source,
    p_from: filters.from,
    p_to: filters.to,
    p_member_id: filters.memberId,
    p_sport_type: filters.sportType,
  };
}

export function normalizeLeaderboardRow(
  row: LeaderboardRpcRow,
): LeaderboardRow {
  return {
    place: toNumber(row.place),
    userId: row.user_id,
    displayName: row.display_name,
    seasonId: row.season_id,
    seasonName: row.season_name,
    totalPoints: toNumber(row.total_points),
    totalRides: toNumber(row.total_rides),
    samstagsFahrten: toNumber(row.samstags_fahrten),
    mittwochsFahrten: toNumber(row.mittwochs_fahrten),
    sonderevents: toNumber(row.sonderevents),
    manualPoints: toNumber(row.manual_points),
    lastActivityAt: row.last_activity_at,
  };
}

export function sortLeaderboardRows(
  rows: LeaderboardRow[],
  sortKey: LeaderboardSortKey,
  sortDirection: LeaderboardSortDirection,
): LeaderboardRow[] {
  return [...rows].sort((left, right) => {
    const primary = compareValues(
      getSortableValue(left, sortKey),
      getSortableValue(right, sortKey),
      sortDirection,
    );

    if (primary !== 0) {
      return primary;
    }

    return (
      left.place - right.place ||
      left.displayName.localeCompare(right.displayName, "de")
    );
  });
}

export function buildLeaderboardResponse(input: {
  rows: LeaderboardRow[];
  filters: LeaderboardFilters;
  options: LeaderboardResponse["options"];
  sortKey: LeaderboardSortKey;
  sortDirection: LeaderboardSortDirection;
  generatedAt?: Date;
}): LeaderboardResponse {
  return {
    rows: sortLeaderboardRows(input.rows, input.sortKey, input.sortDirection),
    filters: input.filters,
    sort: {
      key: input.sortKey,
      direction: input.sortDirection,
    },
    options: input.options,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
  };
}

function parseTextFilter(value: string | null): string | null {
  if (!value || value === "all") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function parseUuidFilter(value: string | null): string | null {
  if (!value || value === "all") {
    return null;
  }

  return UUID_PATTERN.test(value) ? value : null;
}

function parseDateFilter(value: string | null): string | null {
  if (!value || !ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10) === value ? value : null;
}

function parseSourceFilter(value: string | null): "strava" | "manual" | null {
  return value === "strava" || value === "manual" ? value : null;
}

function parseSortKey(value: string | null): LeaderboardSortKey {
  return value && sortKeys.has(value as LeaderboardSortKey)
    ? (value as LeaderboardSortKey)
    : defaultQuery.sortKey;
}

function parseSortDirection(value: string | null): LeaderboardSortDirection {
  return value === "asc" ? "asc" : defaultQuery.sortDirection;
}

function toNumber(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}

function getSortableValue(
  row: LeaderboardRow,
  sortKey: LeaderboardSortKey,
): number | string | null {
  switch (sortKey) {
    case "place":
      return row.place;
    case "displayName":
      return row.displayName;
    case "totalPoints":
      return row.totalPoints;
    case "totalRides":
      return row.totalRides;
    case "samstagsFahrten":
      return row.samstagsFahrten;
    case "mittwochsFahrten":
      return row.mittwochsFahrten;
    case "sonderevents":
      return row.sonderevents;
    case "manualPoints":
      return row.manualPoints;
    case "lastActivityAt":
      return row.lastActivityAt;
  }
}

function compareValues(
  left: number | string | null,
  right: number | string | null,
  direction: LeaderboardSortDirection,
) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const factor = direction === "asc" ? 1 : -1;

  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * factor;
  }

  return String(left).localeCompare(String(right), "de") * factor;
}
