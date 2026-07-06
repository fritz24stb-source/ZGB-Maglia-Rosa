import { type NextRequest } from "next/server";
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
  context: { params: Promise<{ inviteId: string }> },
) {
  try {
    await requireAdminSession(request);
    validateAdminOrigin(request);

    const { inviteId } = await context.params;
    const supabase = createSupabaseServiceRoleClient();
    const beforeResult = await supabase
      .from("app_invites")
      .select("*")
      .eq("id", inviteId)
      .single();

    if (beforeResult.error) {
      throw beforeResult.error;
    }

    const { data, error } = await supabase
      .from("app_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", inviteId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await writeAdminAuditLog(supabase, {
      action: "invite.revoke",
      after: data,
      before: beforeResult.data,
      entityId: inviteId,
      entityType: "app_invite",
    });

    return redirectWithAdminFlash(request, "/admin/invitations", {
      status: "Einladung wurde widerrufen.",
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/invitations", {
      error: formatAdminError(error),
    });
  }
}
