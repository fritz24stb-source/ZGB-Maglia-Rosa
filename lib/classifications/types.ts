export type ClassificationKind = "rosa" | "ciclamino" | "azzurra";

export type ClassificationSeason = {
  id: string;
  name: string;
  isActive: boolean;
  startsOn: string;
  endsOn: string;
};

export type CiclaminoLeaderboardRow = {
  place: number;
  userId: string;
  displayName: string;
  seasonId: string;
  seasonName: string;
  totalPoints: number;
  wins: number;
  secondPlaces: number;
  thirdPlaces: number;
  sprintCount: number;
};

export type AzzurraLeaderboardRow = {
  place: number;
  userId: string;
  displayName: string;
  seasonId: string;
  seasonName: string;
  startsOn: string;
  endsOn: string;
  totalElevationGainM: number;
  totalDistanceM: number;
  rideCount: number;
  missingElevationCount: number;
};

export type ClassificationLeaderboardResponse = {
  seasons: ClassificationSeason[];
  selectedSeasonId: string | null;
  ciclamino: CiclaminoLeaderboardRow[];
  azzurra: AzzurraLeaderboardRow[];
};
