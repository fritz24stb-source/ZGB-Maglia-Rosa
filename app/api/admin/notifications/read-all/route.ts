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

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const supabase = createSupabaseServiceRoleClient();
    const countResult = await supabase
      .from("admin_notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);

    if (countResult.error || error) {
      throw countResult.error ?? error;
    }

    await writeAdminAuditLog(supabase, {
      action: "notification.read_all",
      after: { count: countResult.count ?? 0 },
      entityId: null,
      entityType: "admin_notification",
    });

    return redirectWithAdminFlash(request, "/admin", {
      status: "Alle Benachrichtigungen wurden als gelesen markiert.",
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
