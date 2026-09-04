import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireActiveAppUser } from "@/lib/auth/guards";
import { canAccessAzzurra } from "@/lib/classifications/access";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    validateOrigin(request);
    const access = await requireActiveAppUser();
    if (!canAccessAzzurra(access.profile.role)) {
      throw new Error("Wertungen sind für dieses Profil noch nicht aktiv.");
    }
    const formData = await request.formData();
    const seasonId = requiredText(formData, "seasonId");
    const startsOn = requiredDate(formData, "startsOn");
    const supabase = createSupabaseServiceRoleClient();
    const { data: existing, error: selectError } = await supabase
      .from("azzurra_windows")
      .select("*")
      .eq("user_id", access.userId)
      .eq("season_id", seasonId)
      .maybeSingle();

    if (selectError) throw selectError;
    if (existing) {
      throw new Error(
        "Die Azzurra-Woche dieser Saison wurde bereits festgelegt.",
      );
    }

    const { error } = await supabase.from("azzurra_windows").insert({
      user_id: access.userId,
      season_id: seasonId,
      starts_on: startsOn,
      selected_by: access.userId,
    });
    if (error) throw error;

    await writeAdminAuditLog(supabase, {
      action: "azzurra.window.select",
      entityType: "azzurra_window",
      entityId: access.userId,
      after: { seasonId, startsOn, actorUserId: access.userId },
    });

    return redirect(request, { status: "Azzurra-Woche gespeichert." });
  } catch (error) {
    return redirect(request, {
      error:
        error instanceof Error
          ? error.message
          : "Azzurra-Woche konnte nicht gespeichert werden.",
    });
  }
}

function validateOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_BASE_URL ?? request.url).origin;
  if (origin && origin !== expected)
    throw new Error("Ungültiger Request-Origin.");
}

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${key} fehlt.`);
  return value.trim();
}

function requiredDate(formData: FormData, key: string) {
  const value = requiredText(formData, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ungültiges Datum.");
  return value;
}

function redirect(
  request: NextRequest,
  flash: { error?: string; status?: string },
) {
  const url = new URL("/profile", request.url);
  if (flash.error) url.searchParams.set("azzurraError", flash.error);
  if (flash.status) url.searchParams.set("azzurraStatus", flash.status);
  return NextResponse.redirect(url, { status: 303 });
}
