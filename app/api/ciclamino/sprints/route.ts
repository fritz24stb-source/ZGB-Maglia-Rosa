import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { loadCurrentAppAccessState } from "@/lib/auth/guards";
import { canManageCiclamino } from "@/lib/auth/roles";
import { canAccessClassifications } from "@/lib/classifications/access";
import { CICLAMINO_LOCATIONS } from "@/lib/classifications/ciclamino";
import { berlinLocalDateTimeToIso } from "@/lib/date-time";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    validateOrigin(request);
    const access = await loadCurrentAppAccessState();
    if (
      access.kind !== "active" ||
      !canManageCiclamino(access.profile.role) ||
      !canAccessClassifications(access.profile.role)
    ) {
      throw new Error("Keine Berechtigung für die Sprintleitung.");
    }

    const formData = await request.formData();
    const action = textValue(formData, "action") ?? "save";
    const supabase = createSupabaseServiceRoleClient();
    const seasonId = requiredText(formData, "seasonId");
    const sprintDate = requiredDate(formData, "sprintDate");

    if (action === "delete") {
      const { data: before, error: selectError } = await supabase.from("ciclamino_sprints").select("*").eq("season_id", seasonId).eq("sprint_date", sprintDate);
      if (selectError) throw selectError;
      const { data: awardBefore, error: awardSelectError } = await supabase.from("ciclamino_combative_awards").select("*").eq("season_id", seasonId).eq("sprint_date", sprintDate).maybeSingle();
      if (awardSelectError) throw awardSelectError;
      const { error: awardDeleteError } = await supabase.from("ciclamino_combative_awards").delete().eq("season_id", seasonId).eq("sprint_date", sprintDate);
      if (awardDeleteError) throw awardDeleteError;
      const { error: votingWindowDeleteError } = await supabase.from("ciclamino_combative_voting_windows").delete().eq("season_id", seasonId).eq("sprint_date", sprintDate);
      if (votingWindowDeleteError) throw votingWindowDeleteError;
      const { error } = await supabase.from("ciclamino_sprints").delete().eq("season_id", seasonId).eq("sprint_date", sprintDate);
      if (error) throw error;
      await writeAdminAuditLog(supabase, {
        action: "ciclamino.race_day.delete",
        entityType: "ciclamino_race_day",
        entityId: before?.[0]?.id ?? null,
        before: { award: awardBefore, sprints: before },
        after: { actorUserId: access.userId, seasonId, sprintDate },
      });
      return redirect(request, { status: "Sprinttag gelöscht." });
    }

    const sprints = [0, 1, 2].map((locationIndex) => {
      const name = requiredText(formData, `location${locationIndex}Name`);
      const userIds = [1, 2, 3, 4, 5].map((place) => textValue(formData, `location${locationIndex}Place${place}UserId`));
      const selectedUserIds = userIds.filter((userId): userId is string => Boolean(userId));
      if (new Set(selectedUserIds).size !== selectedUserIds.length) {
        throw new Error(`Beim Ortsschild ${name} darf ein Mitglied nur auf einer Position als Override gesetzt werden.`);
      }
      return { name, userIds };
    });

    const selectedLocations = new Set(sprints.map((sprint) => sprint.name));
    if (selectedLocations.size !== CICLAMINO_LOCATIONS.length || CICLAMINO_LOCATIONS.some((location) => !selectedLocations.has(location))) {
      throw new Error("Okel, Heiligenfelde I und Heiligenfelde II müssen je einmal erfasst werden.");
    }

    const originalSeasonId = textValue(formData, "originalSeasonId");
    const originalSprintDate = optionalDate(formData, "originalSprintDate");
    const combativeUserId = textValue(formData, "combativeUserId");
    const voteOpensAt = berlinLocalDateTimeToIso(requiredText(formData, "voteOpensAt"));
    const voteClosesAt = berlinLocalDateTimeToIso(requiredText(formData, "voteClosesAt"));
    if (new Date(voteOpensAt) >= new Date(voteClosesAt)) {
      throw new Error("Der Abstimmungsbeginn muss vor dem Abstimmungsende liegen.");
    }
    if (combativeUserId && new Date(voteClosesAt) > new Date()) {
      throw new Error("Most Combative Rider kann erst nach Ende des Abstimmungszeitraums eingetragen werden.");
    }

    if (!originalSeasonId) {
      const { data: existingSprint, error: existingSprintError } = await supabase
        .from("ciclamino_sprints")
        .select("id")
        .eq("season_id", seasonId)
        .eq("sprint_date", sprintDate)
        .limit(1)
        .maybeSingle();
      if (existingSprintError) throw existingSprintError;
      if (existingSprint) {
        throw new Error("Für dieses Datum existiert bereits ein Sprinttag. Bitte verwende Bearbeiten.");
      }
    }

    const { data: savedIds, error } = await supabase.rpc("save_ciclamino_race_day", {
      p_actor_user_id: access.userId,
      p_combative_user_id: combativeUserId,
      p_original_season_id: originalSeasonId,
      p_original_sprint_date: originalSprintDate,
      p_season_id: seasonId,
      p_sprint_date: sprintDate,
      p_sprints: sprints as Json,
      p_vote_closes_at: voteClosesAt,
      p_vote_opens_at: voteOpensAt,
    });
    if (error) throw error;

    await writeAdminAuditLog(supabase, {
      action: originalSeasonId ? "ciclamino.race_day.update" : "ciclamino.race_day.create",
      entityType: "ciclamino_race_day",
      entityId: savedIds?.[0] ?? null,
      after: { actorUserId: access.userId, combativeUserId, seasonId, sprintDate, sprints, voteClosesAt, voteOpensAt },
    });
    return redirect(request, { status: originalSeasonId ? "Sprinttag aktualisiert." : "Sprinttag konfiguriert." });
  } catch (error) {
    return redirect(request, { error: error instanceof Error ? error.message : "Sprinttag konnte nicht gespeichert werden." });
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
function optionalDate(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ungültiges Datum.");
  return value;
}
function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function redirect(request: NextRequest, flash: { error?: string; status?: string }) {
  const url = new URL("/sprints", request.url);
  if (flash.error) url.searchParams.set("adminError", flash.error);
  if (flash.status) url.searchParams.set("adminStatus", flash.status);
  return NextResponse.redirect(url, { status: 303 });
}
