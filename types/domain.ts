import type { UserRole } from "@/lib/auth/roles";

export type ActivitySource = "strava" | "manual";
export type ActivityStatus = "active" | "ignored" | "deleted";
export type RuleType = "standard" | "special";

export type Profile = {
  id: string;
  displayName: string;
  role: UserRole;
};

export type Season = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};
