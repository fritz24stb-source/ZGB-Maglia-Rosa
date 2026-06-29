import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getOptionalFormText } from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { syncStravaActivitiesForUser } from "@/lib/strava/admin-sync";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const { userId } = await context.params;
    const formData = await request.formData();
    const seasonId = normalizeSeasonId(
      getOptionalFormText(formData, "seasonId"),
    );
    const supabase = createSupabaseServiceRoleClient();
    const summary = await syncStravaActivitiesForUser({
      client: supabase,
      seasonId,
      userId,
    });

    const notificationResult = await supabase
      .from("admin_notifications")
      .insert({
        type: "admin_sync_user",
        title: "User-Resync abgeschlossen",
        message: formatSyncSummary(summary),
        user_id: userId,
        activity_id: null,
      });

    if (notificationResult.error) {
      throw notificationResult.error;
    }

    await writeAdminAuditLog(supabase, {
      action: "sync.user",
      after: summary,
      entityId: userId,
      entityType: "profile",
    });

    return redirectWithAdminFlash(request, "/admin/members", {
      status: formatSyncSummary(summary),
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/members", {
      error: formatAdminError(error),
    });
  }
}

function normalizeSeasonId(value: string | null) {
  return value && value !== "all" ? value : null;
}

function formatSyncSummary(summary: {
  activitiesFetched: number;
  failed: number;
  skipped: number;
  synced: number;
  users: number;
}) {
  return [
    `${summary.users} User`,
    `${summary.synced} synchronisiert`,
    `${summary.activitiesFetched} von Strava geladen`,
    `${summary.skipped} uebersprungen`,
    `${summary.failed} fehlgeschlagen`,
  ].join(", ");
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
