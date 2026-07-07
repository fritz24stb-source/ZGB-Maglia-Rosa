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
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const { seasonId } = await context.params;
    const supabase = createSupabaseServiceRoleClient();
    const summary = await rescoreSeasonActivities({
      client: supabase,
      seasonId,
    });

    const notificationResult = await supabase
      .from("admin_notifications")
      .insert({
        type: "admin_rescore_season",
        title: "Saison neu bewertet",
        message: formatRescoreSummary(summary),
        user_id: null,
        activity_id: null,
      });

    if (notificationResult.error) {
      throw notificationResult.error;
    }

    await writeAdminAuditLog(supabase, {
      action: "rescore.season",
      after: summary,
      entityId: seasonId,
      entityType: "season",
    });

    return redirectWithAdminFlash(request, "/admin/activities", {
      status: formatRescoreSummary(summary),
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/activities", {
      error: formatAdminError(error),
    });
  }
}

function formatRescoreSummary(summary: {
  failed: number;
  matched: number;
  total: number;
  unmatched: number;
  updated: number;
}) {
  return [
    `${summary.updated}/${summary.total} Aktivitäten neu bewertet`,
    `${summary.matched} Treffer`,
    `${summary.unmatched} ohne Regel`,
    `${summary.failed} Fehler`,
  ].join(", ");
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
