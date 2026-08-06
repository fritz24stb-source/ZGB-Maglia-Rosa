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
  fourthPlaces: number;
  fifthPlaces: number;
  combativeAwards: number;
  sprintCount: number;
};

export type CiclaminoSprintPlacement = {
  displayName: string;
  place: number;
  points: number;
  userId: string;
};

export type CiclaminoSprint = {
  id: string;
  name: string;
  placements: CiclaminoSprintPlacement[];
};

export type CiclaminoSprintDay = {
  combativeRider: {
    displayName: string;
    points: number;
    userId: string;
  } | null;
  key: string;
  seasonId: string;
  seasonName: string;
  sprintDate: string;
  sprints: CiclaminoSprint[];
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
  ciclaminoSprintDays: CiclaminoSprintDay[];
  azzurra: AzzurraLeaderboardRow[];
};
