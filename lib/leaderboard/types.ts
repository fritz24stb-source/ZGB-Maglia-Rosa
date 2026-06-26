import type { Database } from "@/types/database";

export type LeaderboardRpcRow =
  Database["public"]["Functions"]["get_leaderboard"]["Returns"][number];

export type LeaderboardSortKey =
  | "place"
  | "displayName"
  | "totalPoints"
  | "totalRides"
  | "samstagsFahrten"
  | "mittwochsFahrten"
  | "sonderevents"
  | "manualPoints"
  | "lastActivityAt";

export type LeaderboardSortDirection = "asc" | "desc";

export type LeaderboardFilters = {
  seasonId: string | null;
  category: string | null;
  source: "strava" | "manual" | null;
  from: string | null;
  to: string | null;
  memberId: string | null;
  sportType: string | null;
};

export type LeaderboardQuery = {
  filters: LeaderboardFilters;
  sortKey: LeaderboardSortKey;
  sortDirection: LeaderboardSortDirection;
  useActiveSeasonDefault: boolean;
};

export type LeaderboardRow = {
  place: number;
  userId: string;
  displayName: string;
  seasonId: string;
  seasonName: string;
  totalPoints: number;
  totalRides: number;
  samstagsFahrten: number;
  mittwochsFahrten: number;
  sonderevents: number;
  manualPoints: number;
  lastActivityAt: string | null;
};

export type LeaderboardOption = {
  value: string;
  label: string;
};

export type LeaderboardOptions = {
  seasons: (LeaderboardOption & {
    isActive: boolean;
    startsOn: string;
    endsOn: string;
  })[];
  categories: LeaderboardOption[];
  sources: LeaderboardOption[];
  sportTypes: LeaderboardOption[];
};

export type LeaderboardResponse = {
  rows: LeaderboardRow[];
  filters: LeaderboardFilters;
  sort: {
    key: LeaderboardSortKey;
    direction: LeaderboardSortDirection;
  };
  options: LeaderboardOptions;
  generatedAt: string;
};
