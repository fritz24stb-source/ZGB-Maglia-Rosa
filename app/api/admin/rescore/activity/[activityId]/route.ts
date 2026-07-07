import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
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
    const supabase = createSupabaseServiceRoleClient();
    const { data: activity, error } = await supabase
      .from("activities")
      .select("id, season_id")
      .eq("id", activityId)
      .single();

    if (error) {
      throw error;
    }

    const summary = await rescoreSeasonActivities({
      activityIds: [activityId],
      client: supabase,
      includeInactive: true,
      seasonId: activity.season_id,
    });

    await writeAdminAuditLog(supabase, {
      action: "rescore.activity",
      after: summary,
      entityId: activityId,
      entityType: "activity",
    });

    return redirectWithAdminFlash(request, "/admin/activities", {
      status: "Aktivität wurde neu bewertet.",
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/activities", {
      error: formatAdminError(error),
    });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
