import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  getFormCheckbox,
  getFormText,
  getOptionalFormText,
} from "@/lib/admin/forms";
import {
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import {
  assertDisplayNameAvailable,
  isUniqueViolation,
} from "@/lib/auth/app-auth";
import { normalizeDisplayName } from "@/lib/auth/names";
import { isUserRole } from "@/lib/auth/roles";
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
    const action = getOptionalFormText(formData, "action");

    if (action === "delete") {
      return await deleteMember(request, userId);
    }

    const displayName = normalizeDisplayName(
      getFormText(formData, "displayName", "Name fehlt."),
    );
    const role = getFormText(formData, "role", "Rolle fehlt.");
    const isActive = getFormCheckbox(formData, "isActive");

    if (!isUserRole(role)) {
      throw new Error("Ungueltige Rolle.");
    }

    const supabase = createSupabaseServiceRoleClient();
    const before = await getProfile(supabase, userId);
    await assertDisplayNameAvailable(supabase, displayName, {
      exceptUserId: userId,
    });
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        is_active: isActive,
        role,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Dieser Name ist bereits vergeben.");
      }

      throw error;
    }

    await writeAdminAuditLog(supabase, {
      action: "member.update",
      after: data,
      before,
      entityId: userId,
      entityType: "profile",
    });

    return redirectWithAdminFlash(request, "/admin/members", {
      status: "Mitglied wurde aktualisiert.",
    });
  } catch (error) {
    return redirectWithAdminFlash(request, "/admin/members", {
      error: formatAdminError(error),
    });
  }
}

async function deleteMember(request: NextRequest, userId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const before = await getProfile(supabase, userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }

  await writeAdminAuditLog(supabase, {
    action: "member.delete",
    after: null,
    before,
    entityId: userId,
    entityType: "profile",
  });

  return redirectWithAdminFlash(request, "/admin/members", {
    status: "Profil wurde geloescht.",
  });
}

async function getProfile(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
