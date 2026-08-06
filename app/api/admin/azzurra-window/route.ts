import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  formatAdminError,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    validateAdminOrigin(request);
    const admin = await requireAdminSession(request);
    const formData = await request.formData();
    const userId = requiredText(formData, "userId");
    const seasonId = requiredText(formData, "seasonId");
    const action = requiredText(formData, "action");
    let status = "Azzurra-Woche aktualisiert.";
    const supabase = createSupabaseServiceRoleClient();
    const { data: before, error: selectError } = await supabase
      .from("azzurra_windows")
      .select("*")
      .eq("user_id", userId)
      .eq("season_id", seasonId)
      .maybeSingle();
    if (selectError) throw selectError;

    if (action === "reset") {
      const { error } = await supabase
        .from("azzurra_windows")
        .delete()
        .eq("user_id", userId)
        .eq("season_id", seasonId);
      if (error) throw error;
      await writeAdminAuditLog(supabase, {
        action: "azzurra.window.reset",
        entityType: "azzurra_window",
        entityId: userId,
        before,
        after: { seasonId, actorUserId: admin.userId },
      });
      status = "Azzurra-Woche zurückgesetzt. Das Mitglied kann erneut wählen.";
    } else {
      const startsOn = requiredDate(formData, "startsOn");
      const { error } = await supabase.from("azzurra_windows").upsert(
        {
          user_id: userId,
          season_id: seasonId,
          starts_on: startsOn,
          selected_by: admin.userId,
        },
        { onConflict: "user_id,season_id" },
      );
      if (error) throw error;
      await writeAdminAuditLog(supabase, {
        action: before ? "azzurra.window.correct" : "azzurra.window.set_by_admin",
        entityType: "azzurra_window",
        entityId: userId,
        before,
        after: { seasonId, startsOn, actorUserId: admin.userId },
      });
    }

    return redirect(request, { status });
  } catch (error) {
    return redirect(request, { error: formatAdminError(error) });
  }
}

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} fehlt.`);
  return value.trim();
}

function requiredDate(formData: FormData, key: string) {
  const value = requiredText(formData, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ungültiges Datum.");
  return value;
}

function redirect(request: NextRequest, flash: { error?: string; status?: string }) {
  const url = new URL("/admin/members", request.url);
  if (flash.error) url.searchParams.set("adminError", flash.error);
  if (flash.status) url.searchParams.set("adminStatus", flash.status);
  return NextResponse.redirect(url, { status: 303 });
}
