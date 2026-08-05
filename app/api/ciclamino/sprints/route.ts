import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";
import { canManageCiclamino } from "@/lib/auth/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    validateOrigin(request);
    const access = await loadCurrentAppAccessState();

    if (access.kind !== "active" || !canManageCiclamino(access.profile.role)) {
      throw new Error("Keine Berechtigung für die Sprintpflege.");
    }

    const formData = await request.formData();
    const action = textValue(formData, "action") ?? "save";
    const supabase = createSupabaseServiceRoleClient();

    if (action === "delete") {
      const sprintId = requiredText(formData, "sprintId");
      const { data: before, error: selectError } = await supabase
        .from("ciclamino_sprints")
        .select("*")
        .eq("id", sprintId)
        .maybeSingle();

      if (selectError) throw selectError;
      const { error } = await supabase
        .from("ciclamino_sprints")
        .delete()
        .eq("id", sprintId);
      if (error) throw error;

      await writeAdminAuditLog(supabase, {
        action: "ciclamino.sprint.delete",
        entityType: "ciclamino_sprint",
        entityId: sprintId,
        before,
        after: { actorUserId: access.userId },
      });

      return redirect(request, { status: "Sprint gelöscht." });
    }

    const sprintId = textValue(formData, "sprintId");
    const seasonId = requiredText(formData, "seasonId");
    const sprintDate = requiredDate(formData, "sprintDate");
    const name = requiredText(formData, "name");
    const userIds = [1, 2, 3].map((place) =>
      requiredText(formData, `place${place}UserId`),
    );

    if (new Set(userIds).size !== 3) {
      throw new Error("Jedes Mitglied darf pro Sprint nur einmal vorkommen.");
    }

    const { data: savedId, error } = await supabase.rpc(
      "save_ciclamino_sprint",
      {
        p_sprint_id: sprintId,
        p_season_id: seasonId,
        p_sprint_date: sprintDate,
        p_name: name,
        p_user_ids: userIds,
        p_actor_user_id: access.userId,
      },
    );

    if (error) throw error;

    await writeAdminAuditLog(supabase, {
      action: sprintId ? "ciclamino.sprint.update" : "ciclamino.sprint.create",
      entityType: "ciclamino_sprint",
      entityId: savedId,
      after: { seasonId, sprintDate, name, userIds, actorUserId: access.userId },
    });

    return redirect(request, {
      status: sprintId ? "Sprint aktualisiert." : "Sprint angelegt.",
    });
  } catch (error) {
    return redirect(request, {
      error: error instanceof Error ? error.message : "Sprint konnte nicht gespeichert werden.",
    });
  }
}

function validateOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_BASE_URL ?? request.url).origin;
  if (origin && origin !== expected) throw new Error("Ungültiger Request-Origin.");
}

function requiredText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!value) throw new Error(`${key} fehlt.`);
  return value;
}

function requiredDate(formData: FormData, key: string) {
  const value = requiredText(formData, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ungültiges Datum.");
  return value;
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function redirect(
  request: NextRequest,
  flash: { error?: string; status?: string },
) {
  const url = new URL("/sprints", request.url);
  if (flash.error) url.searchParams.set("adminError", flash.error);
  if (flash.status) url.searchParams.set("adminStatus", flash.status);
  return NextResponse.redirect(url, { status: 303 });
}
