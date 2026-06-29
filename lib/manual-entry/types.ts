import type { Database } from "@/types/database";

export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ManualEntryWindowRow =
  Database["public"]["Tables"]["manual_entry_windows"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ScoringRuleRow =
  Database["public"]["Tables"]["scoring_rules"]["Row"];
export type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

export type ManualEntrySeason = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
};

export type ManualEntryOptionStatus = "open" | "used" | "closed";

export type ManualEntryOption = {
  ruleId: string;
  category: string;
  label: string;
  points: number;
  ruleType: "standard" | "special";
  status: ManualEntryOptionStatus;
  opensAt: string;
  closesAt: string;
  nextOpensAt: string | null;
  maxEntries: number;
  existingEntries: number;
  remainingEntries: number;
  unavailableReason: string | null;
};

export type ManualEntryState =
  | { kind: "anonymous" }
  | { kind: "unconfigured"; message: string }
  | {
      kind: "unavailable";
      generatedAt: string;
      profileName: string | null;
      season: ManualEntrySeason | null;
      reason: string;
      nextOpensAt: string | null;
    }
  | {
      kind: "ready";
      generatedAt: string;
      profileName: string | null;
      season: ManualEntrySeason;
      options: ManualEntryOption[];
      nextOpensAt: string | null;
      defaultActivityStartedLocal: string;
    };

export type ManualEntryContext = ManualEntryOption & {
  manualEntryKey: string;
  rule: ScoringRuleRow;
  timeZone: string;
};

export type ManualEntryEvaluation =
  | {
      kind: "unavailable";
      state: Extract<ManualEntryState, { kind: "unavailable" }>;
      contexts: [];
      season: SeasonRow | null;
      profile: Pick<ProfileRow, "display_name" | "id" | "is_active"> | null;
    }
  | {
      kind: "ready";
      state: Extract<ManualEntryState, { kind: "ready" }>;
      contexts: ManualEntryContext[];
      season: SeasonRow;
      profile: Pick<ProfileRow, "display_name" | "id" | "is_active"> | null;
    };
