import "server-only";

import { buildManualEntryContexts, getNextManualEntryOpening } from "./options";
import {
  MANUAL_ENTRY_TIME_ZONE,
  getLocalDateString,
  toLocalInputValue,
} from "./time";
import type {
  ActivityRow,
  ManualEntryContext,
  ManualEntryEvaluation,
  ManualEntryOption,
  ManualEntryState,
  ManualEntryWindowRow,
  ProfileRow,
  ScoringRuleRow,
  SeasonRow,
} from "./types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type AppClient = Pick<
  Awaited<ReturnType<typeof createSupabaseServerClient>>,
  "from"
>;
type ProfileSummary = Pick<ProfileRow, "display_name" | "is_active">;

export async function loadManualEntryStateForUser(
  client: AppClient,
  userId: string,
  now = new Date(),
): Promise<ManualEntryState> {
  const evaluation = await loadManualEntryEvaluation(client, userId, now);

  return evaluation.state;
}

export async function loadManualEntryEvaluation(
  client: AppClient,
  userId: string,
  now = new Date(),
): Promise<ManualEntryEvaluation> {
  const [profileResult, seasonResult] = await Promise.all([
    client
      .from("profiles")
      .select("display_name, is_active")
      .eq("id", userId)
      .maybeSingle(),
    client
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error || seasonResult.error) {
    throw profileResult.error ?? seasonResult.error;
  }

  const profile = profileResult.data as ProfileSummary | null;
  const season = seasonResult.data as SeasonRow | null;
  const generatedAt = now.toISOString();

  if (!profile?.is_active) {
    return buildUnavailableEvaluation({
      generatedAt,
      profile,
      reason: "Kein aktives Mitgliederprofil gefunden.",
      season,
    });
  }

  if (!season) {
    return buildUnavailableEvaluation({
      generatedAt,
      profile,
      reason: "Keine aktive Saison konfiguriert.",
      season: null,
    });
  }

  const today = getLocalDateString(now, MANUAL_ENTRY_TIME_ZONE);

  if (today < season.starts_on) {
    return buildUnavailableEvaluation({
      generatedAt,
      profile,
      reason: `Die aktive Saison beginnt erst am ${season.starts_on}.`,
      season,
    });
  }

  if (today > season.ends_on) {
    return buildUnavailableEvaluation({
      generatedAt,
      profile,
      reason: `Die aktive Saison endete am ${season.ends_on}.`,
      season,
    });
  }

  const [rulesResult, windowsResult] = await Promise.all([
    client
      .from("scoring_rules")
      .select("*")
      .eq("is_active", true)
      .eq("manual_entry_allowed", true)
      .or(`season_id.is.null,season_id.eq.${season.id}`),
    client.from("manual_entry_windows").select("*").eq("active", true),
  ]);

  if (rulesResult.error || windowsResult.error) {
    throw rulesResult.error ?? windowsResult.error;
  }

  const rules = (rulesResult.data ?? []) as ScoringRuleRow[];
  const windows = (windowsResult.data ?? []) as ManualEntryWindowRow[];
  const initialContexts = buildManualEntryContexts({
    existingEntryCounts: new Map(),
    now,
    rules,
    windows,
  });

  if (initialContexts.length === 0) {
    return buildUnavailableEvaluation({
      generatedAt,
      profile,
      reason: "Keine manuelle Eingabekategorie ist aktiv konfiguriert.",
      season,
    });
  }

  const existingEntryCounts = await loadExistingEntryCounts(
    client,
    userId,
    season.id,
    initialContexts,
  );
  const contexts = buildManualEntryContexts({
    existingEntryCounts,
    now,
    rules,
    windows,
  });
  const options = contexts.map(toPublicOption);
  const state: Extract<ManualEntryState, { kind: "ready" }> = {
    kind: "ready",
    generatedAt,
    profileName: profile.display_name,
    season: toManualEntrySeason(season),
    options,
    nextOpensAt: getNextManualEntryOpening(options),
    defaultActivityStartedLocal: toLocalInputValue(now, MANUAL_ENTRY_TIME_ZONE),
  };

  return {
    kind: "ready",
    state,
    contexts,
    season,
    profile,
  };
}

async function loadExistingEntryCounts(
  client: AppClient,
  userId: string,
  seasonId: string,
  contexts: ManualEntryContext[],
) {
  const keys = [...new Set(contexts.map((context) => context.manualEntryKey))];

  if (keys.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await client
    .from("activities")
    .select("manual_entry_key")
    .eq("user_id", userId)
    .eq("season_id", seasonId)
    .eq("source", "manual")
    .eq("status", "active")
    .in("manual_entry_key", keys);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((counts, row) => {
    const manualEntryKey = (row as Pick<ActivityRow, "manual_entry_key">)
      .manual_entry_key;

    if (manualEntryKey) {
      counts.set(manualEntryKey, (counts.get(manualEntryKey) ?? 0) + 1);
    }

    return counts;
  }, new Map<string, number>());
}

function buildUnavailableEvaluation(input: {
  generatedAt: string;
  profile: ProfileSummary | null;
  reason: string;
  season: SeasonRow | null;
}): ManualEntryEvaluation {
  return {
    kind: "unavailable",
    state: {
      kind: "unavailable",
      generatedAt: input.generatedAt,
      profileName: input.profile?.display_name ?? null,
      season: input.season ? toManualEntrySeason(input.season) : null,
      reason: input.reason,
      nextOpensAt: null,
    },
    contexts: [],
    season: input.season,
    profile: input.profile,
  };
}

function toManualEntrySeason(season: SeasonRow) {
  return {
    id: season.id,
    name: season.name,
    startsOn: season.starts_on,
    endsOn: season.ends_on,
  };
}

function toPublicOption(context: ManualEntryContext): ManualEntryOption {
  return {
    ruleId: context.ruleId,
    category: context.category,
    label: context.label,
    points: context.points,
    ruleType: context.ruleType,
    status: context.status,
    opensAt: context.opensAt,
    closesAt: context.closesAt,
    nextOpensAt: context.nextOpensAt,
    maxEntries: context.maxEntries,
    existingEntries: context.existingEntries,
    remainingEntries: context.remainingEntries,
    unavailableReason: context.unavailableReason,
  };
}
