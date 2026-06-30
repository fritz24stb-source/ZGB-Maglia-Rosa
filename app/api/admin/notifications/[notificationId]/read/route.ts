import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const { notificationId } = await context.params;
    const supabase = createSupabaseServiceRoleClient();
    const { data: before, error: beforeError } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (beforeError) {
      throw beforeError;
    }

    const { data, error } = await supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await writeAdminAuditLog(supabase, {
      action: "notification.read",
      after: data,
      before,
      entityId: notificationId,
      entityType: "admin_notification",
    });

    return redirectWithAdminFlash(request, "/admin", {
      status: "Benachrichtigung wurde als gelesen markiert.",
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin", {
      error: formatAdminError(error),
    });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
