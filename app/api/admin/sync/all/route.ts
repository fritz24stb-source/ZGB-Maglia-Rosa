import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { getOptionalFormText } from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { syncStravaActivitiesForActiveUsers } from "@/lib/strava/admin-sync";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const formData = await request.formData();
    const seasonId = normalizeSeasonId(
      getOptionalFormText(formData, "seasonId"),
    );
    const supabase = createSupabaseServiceRoleClient();
    const summary = await syncStravaActivitiesForActiveUsers({
      client: supabase,
      seasonId,
    });

    const notificationResult = await supabase
      .from("admin_notifications")
      .insert({
        type: "admin_sync_all",
        title: "Gesamt-Resync abgeschlossen",
        message: formatSyncSummary(summary),
        user_id: null,
        activity_id: null,
      });

    if (notificationResult.error) {
      throw notificationResult.error;
    }

    await writeAdminAuditLog(supabase, {
      action: "sync.all",
      after: summary,
      entityId: null,
      entityType: "sync",
    });

    return redirectWithAdminFlash(request, "/admin", {
      status: formatSyncSummary(summary),
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin", {
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
    `${summary.skipped} übersprungen`,
    `${summary.failed} fehlgeschlagen`,
  ].join(", ");
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
