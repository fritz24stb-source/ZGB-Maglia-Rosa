import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getFormText } from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { rescoreSeasonActivities } from "@/lib/scoring";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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

    if (action === "ignore") {
      const { data, error } = await supabase
        .from("activities")
        .update({
          awarded_points: 0,
          category: null,
          matched_category: null,
          matched_rule_id: null,
          matched_rule_name: null,
          points: 0,
          scored_at: new Date().toISOString(),
          scoring_reason: "Admin: Aktivitaet aus Wertung ausgeschlossen.",
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
        status: "Aktivitaet wurde aus der Wertung ausgeschlossen.",
      });
    }

    if (action === "reactivate") {
      if (before.status === "deleted") {
        throw new Error(
          "Geloeschte Strava-Aktivitaeten koennen nicht reaktiviert werden.",
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
        status: "Aktivitaet wurde reaktiviert und neu bewertet.",
      });
    }

    throw new Error("Unbekannte Aktivitaets-Aktion.");
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

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
