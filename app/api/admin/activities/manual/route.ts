import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  getFormText,
  getOptionalFormNumber,
  getOptionalFormText,
} from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { parseManualLocalDateTime } from "@/lib/manual-entry/time";
import {
  isScoreResultScored,
  scoreActivity,
  toActivityScoreUpdate,
  type ScorableActivity,
} from "@/lib/scoring";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ScoringRuleRow = Database["public"]["Tables"]["scoring_rules"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_DISTANCE_KM = 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const now = new Date();
    const formData = await request.formData();
    const userId = getFormText(formData, "userId", "Mitglied fehlt.");
    const seasonId = getFormText(formData, "seasonId", "Saison fehlt.");
    const ruleId = getFormText(formData, "ruleId", "Scoring-Regel fehlt.");
    const activityStartedLocal = getFormText(
      formData,
      "activityStartedLocal",
      "Aktivitaetszeitpunkt fehlt.",
    );
    const sportType = getOptionalFormText(formData, "sportType") ?? "Ride";
    const comment = getOptionalFormText(formData, "comment");
    const distanceKm = getOptionalFormNumber(formData, "distanceKm", {
      min: 0,
      max: MAX_DISTANCE_KM,
    });
    const distanceM =
      distanceKm === null ? null : Math.round(distanceKm * 1000);
    const supabase = createSupabaseServiceRoleClient();
    const [profile, season, rule] = await Promise.all([
      getProfile(supabase, userId),
      getSeason(supabase, seasonId),
      getScoringRule(supabase, ruleId),
    ]);

    if (!profile.is_active) {
      throw new Error("Mitglied ist nicht aktiv.");
    }

    if (rule.season_id && rule.season_id !== season.id) {
      throw new Error("Scoring-Regel gehoert nicht zur gewaehlten Saison.");
    }

    const localActivityTime = parseManualLocalDateTime(activityStartedLocal);

    if (!localActivityTime) {
      throw new Error("Ungueltiger Aktivitaetszeitpunkt.");
    }

    if (
      localActivityTime.localDate < season.starts_on ||
      localActivityTime.localDate > season.ends_on
    ) {
      throw new Error(
        "Aktivitaetszeitpunkt liegt ausserhalb der gewaehlten Saison.",
      );
    }

    if (
      localActivityTime.utcDate.getTime() >
      now.getTime() + FUTURE_TOLERANCE_MS
    ) {
      throw new Error("Aktivitaetszeitpunkt darf nicht in der Zukunft liegen.");
    }

    const activityName =
      getOptionalFormText(formData, "activityName") ??
      `Admin manuell: ${rule.name}`;
    const activityDraft: ScorableActivity = {
      id: "admin-manual-draft",
      season_id: season.id,
      source: "manual",
      activity_name: activityName,
      sport_type: sportType,
      distance_m: distanceM,
      activity_started_at: localActivityTime.utcDate.toISOString(),
      activity_started_local_at: localActivityTime.localIsoWithOffset,
      status: "active",
      manually_entered: true,
      scoring_override_rule_id: rule.id,
    };
    const score = scoreActivity(activityDraft, [rule], { scoredAt: now });

    if (!isScoreResultScored(score)) {
      throw new Error("Ausgewaehlte Regel konnte nicht angewendet werden.");
    }

    const activityInsert: ActivityInsert = {
      user_id: profile.id,
      season_id: season.id,
      strava_activity_id: null,
      source: "manual",
      activity_name: activityName,
      sport_type: sportType,
      distance_m: distanceM,
      activity_started_at: localActivityTime.utcDate.toISOString(),
      activity_started_local_at: localActivityTime.localIsoWithOffset,
      uploaded_or_created_at: now.toISOString(),
      status: "active",
      manually_entered: true,
      manual_comment: comment,
      manual_entry_key: null,
      strava_url: null,
      scoring_override_rule_id: rule.id,
      ...toActivityScoreUpdate(score),
    };
    const { data: activity, error } = await supabase
      .from("activities")
      .insert(activityInsert)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await writeAdminAuditLog(supabase, {
      action: "activity.admin_manual_create",
      after: activity,
      entityId: activity.id,
      entityType: "activity",
    });

    return redirectWithAdminFlash(request, "/admin/activities", {
      status: "Manuelle Admin-Aktivitaet wurde hinzugefuegt.",
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/activities", {
      error: formatAdminError(error),
    });
  }
}

async function getProfile(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

async function getSeason(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  seasonId: string,
) {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .single();

  if (error) {
    throw error;
  }

  return data as SeasonRow;
}

async function getScoringRule(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  ruleId: string,
) {
  const { data, error } = await supabase
    .from("scoring_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("is_active", true)
    .single();

  if (error) {
    throw error;
  }

  return data as ScoringRuleRow;
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
