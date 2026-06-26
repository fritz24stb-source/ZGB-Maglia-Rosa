import type { Database } from "@/types/database";

export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ScoringRuleRow =
  Database["public"]["Tables"]["scoring_rules"]["Row"];

export type ScorableActivity = Pick<
  ActivityRow,
  | "id"
  | "season_id"
  | "source"
  | "activity_name"
  | "sport_type"
  | "activity_started_at"
  | "activity_started_local_at"
  | "status"
  | "manually_entered"
  | "distance_m"
>;

export type ScoreResult = {
  points: number;
  category: string | null;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  matchedCategory: string | null;
  awardedPoints: number;
  scoringReason: string;
  scoredAt: string;
};

export type ActivityScoreUpdate = {
  category: string | null;
  points: number;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  matched_category: string | null;
  awarded_points: number;
  scoring_reason: string;
  scored_at: string;
};
