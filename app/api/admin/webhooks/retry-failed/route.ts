import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { processPendingStravaWebhookEvents } from "@/lib/strava/webhook-processor";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETRY_BATCH_LIMIT = 25;

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const supabase = createSupabaseServiceRoleClient();
    const summary = await processPendingStravaWebhookEvents({
      client: supabase,
      limit: RETRY_BATCH_LIMIT,
    });

    await writeAdminAuditLog(supabase, {
      action: "webhook.retry_failed",
      after: summary,
      entityId: null,
      entityType: "webhook_event",
    });

    return redirectWithAdminFlash(request, "/admin#failed-webhook-events", {
      status: formatRetrySummary(summary),
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin#failed-webhook-events", {
      error: formatAdminError(error),
    });
  }
}

function formatRetrySummary(summary: {
  duplicates: number;
  failed: number;
  ignored: number;
  processed: number;
}) {
  const resolved = summary.processed + summary.ignored;

  return [
    `${resolved} Webhook Events bereinigt`,
    `${summary.failed} weiterhin fehlgeschlagen`,
    `${summary.duplicates} nicht erneut verarbeitet`,
  ].join(", ");
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
