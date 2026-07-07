import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getFormText } from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import {
  isScoreResultScored,
  rescoreSeasonActivities,
  scoreActivity,
  toActivityScoreUpdate,
} from "@/lib/scoring";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ScoringRuleRow = Database["public"]["Tables"]["scoring_rules"]["Row"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ activityId: string }> },
) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const { activityId } = await context.params;
    const formData = await request.formData();
    const action = getFormText(formData, "action", "Aktion fehlt.");
    const supabase = createSupabaseServiceRoleClient();
    const before = await getActivity(supabase, activityId);

    if (action === "score") {
      const ruleId = getFormText(formData, "ruleId", "Scoring-Regel fehlt.");
      const rule = await getScoringRule(supabase, ruleId);

      if (before.status === "deleted") {
        throw new Error(
          "Gelöschte Strava-Aktivitäten können nicht zur Wertung hinzugefügt werden.",
        );
      }

      if (before.source !== "strava") {
        throw new Error(
          "Diese Aktion ist nur für synchronisierte Strava-Aktivitäten vorgesehen.",
        );
      }

      ensureRuleCanScoreActivity(rule, before);

      const scoredAt = new Date();
      const score = scoreActivity(
        {
          ...before,
          status: "active",
          scoring_override_rule_id: rule.id,
        },
        [rule],
        { scoredAt },
      );

      if (!isScoreResultScored(score)) {
        throw new Error("Ausgewählte Regel konnte nicht angewendet werden.");
      }

      const { data, error } = await supabase
        .from("activities")
        .update({
          status: "active",
          scoring_override_rule_id: rule.id,
          ...toActivityScoreUpdate(score),
        })
        .eq("id", activityId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: "activity.score_override",
        after: data,
        before,
        entityId: activityId,
        entityType: "activity",
      });

      return redirectWithAdminFlash(request, "/admin/activities", {
        status: "Aktivität wurde zur Wertung hinzugefügt.",
      });
    }

    if (action === "ignore") {
      const { data, error } = await supabase
        .from("activities")
        .update({
          awarded_points: 0,
          category: null,
          matched_category: null,
          matched_rule_id: null,
          matched_rule_name: null,
          scoring_override_rule_id: null,
          points: 0,
          scored_at: new Date().toISOString(),
          scoring_reason: "Admin: Aktivität aus Wertung ausgeschlossen.",
          status: "ignored",
        })
        .eq("id", activityId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await writeAdminAuditLog(supabase, {
        action: "activity.ignore",
        after: data,
        before,
        entityId: activityId,
        entityType: "activity",
      });

      return redirectWithAdminFlash(request, "/admin/activities", {
        status: "Aktivität wurde aus der Wertung ausgeschlossen.",
      });
    }

    if (action === "reactivate") {
      if (before.status === "deleted") {
        throw new Error(
          "Gelöschte Strava-Aktivitäten können nicht reaktiviert werden.",
        );
      }

      const { data, error } = await supabase
        .from("activities")
        .update({ status: "active" })
        .eq("id", activityId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const summary = await rescoreSeasonActivities({
        activityIds: [activityId],
        client: supabase,
        includeInactive: true,
        seasonId: data.season_id,
      });

      await writeAdminAuditLog(supabase, {
        action: "activity.reactivate",
        after: { activity: data, summary },
        before,
        entityId: activityId,
        entityType: "activity",
      });

      return redirectWithAdminFlash(request, "/admin/activities", {
        status: "Aktivität wurde reaktiviert und neu bewertet.",
      });
    }

    throw new Error("Unbekannte Aktivitäts-Aktion.");
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/activities", {
      error: formatAdminError(error),
    });
  }
}

async function getActivity(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  activityId: string,
) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (error) {
    throw error;
  }

  return data;
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

function ensureRuleCanScoreActivity(
  rule: ScoringRuleRow,
  activity: ActivityRow,
) {
  if (rule.season_id && rule.season_id !== activity.season_id) {
    throw new Error("Scoring-Regel gehört nicht zur Saison der Aktivität.");
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
