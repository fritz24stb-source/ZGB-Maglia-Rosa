import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import {
  getFormCheckbox,
  getFormText,
  getOptionalFormText,
} from "@/lib/admin/forms";
import {
  AdminHttpError,
  formatAdminError,
  redirectWithAdminFlash,
  requireAdminSession,
  validateAdminOrigin,
} from "@/lib/admin/http";
import {
  assertDisplayNameAvailable,
  isUniqueViolation,
} from "@/lib/auth/app-auth";
import {
  LAST_ACTIVE_ADMIN_MESSAGE,
  removesActiveAdminAccess,
} from "@/lib/auth/admin-access";
import { normalizeDisplayName } from "@/lib/auth/names";
import { isUserRole } from "@/lib/auth/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { purgeStravaDataForUser } from "@/lib/strava/data-retention";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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

    if (action === "purge-strava") {
      return await purgeMemberStravaData(request, userId);
    }

    if (action === "adjust-points") {
      return await adjustMemberPoints(request, userId, formData);
    }

    const displayName = normalizeDisplayName(
      getFormText(formData, "displayName", "Name fehlt."),
    );
    const role = getFormText(formData, "role", "Rolle fehlt.");
    const isActive = getFormCheckbox(formData, "isActive");

    if (!isUserRole(role)) {
      throw new Error("Ungültige Rolle.");
    }

    const supabase = createSupabaseServiceRoleClient();
    const before = await getProfile(supabase, userId);
    await assertKeepsActiveAdmin(supabase, before, {
      is_active: isActive,
      role,
    });
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
  await assertKeepsActiveAdmin(supabase, before, null);
  const purgeSummary = await purgeStravaDataForUser(supabase, userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }

  await writeAdminAuditLog(supabase, {
    action: "member.delete",
    after: { stravaPurge: purgeSummary },
    before,
    entityId: userId,
    entityType: "profile",
  });

  return redirectWithAdminFlash(request, "/admin/members", {
    status: "Profil wurde gelöscht.",
  });
}

async function purgeMemberStravaData(request: NextRequest, userId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const before = await getProfile(supabase, userId);
  const summary = await purgeStravaDataForUser(supabase, userId);

  await writeAdminAuditLog(supabase, {
    action: "member.strava_purge",
    after: summary,
    before,
    entityId: userId,
    entityType: "profile",
  });

  return redirectWithAdminFlash(request, "/admin/members", {
    status: `Strava-Daten bereinigt (${summary.activitiesErased} Aktivitaeten).`,
  });
}

async function adjustMemberPoints(
  request: NextRequest,
  userId: string,
  formData: FormData,
) {
  const seasonId = getFormText(formData, "seasonId", "Saison fehlt.");
  const deltaText = getFormText(
    formData,
    "pointsDelta",
    "Punktekorrektur fehlt.",
  );
  const reason = getOptionalFormText(formData, "reason");
  const delta = Number(deltaText);

  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10_000) {
    throw new AdminHttpError(
      400,
      "Die Punktekorrektur muss eine ganze Zahl zwischen -10000 und 10000 sein und darf nicht 0 sein.",
    );
  }

  if (reason && reason.length > 500) {
    throw new AdminHttpError(
      400,
      "Die Begründung darf maximal 500 Zeichen lang sein.",
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const [profile, seasonResult, currentResult] = await Promise.all([
    getProfile(supabase, userId),
    supabase.from("seasons").select("id, name").eq("id", seasonId).single(),
    supabase
      .from("member_point_adjustments")
      .select("*")
      .eq("user_id", userId)
      .eq("season_id", seasonId)
      .maybeSingle(),
  ]);

  if (seasonResult.error || currentResult.error) {
    throw seasonResult.error ?? currentResult.error;
  }

  const before = currentResult.data;
  const nextPoints = (before?.points ?? 0) + delta;

  if (Math.abs(nextPoints) > 1_000_000) {
    throw new AdminHttpError(
      400,
      "Die gesamte Punktekorrektur darf maximal ±1000000 Punkte betragen.",
    );
  }

  const { data, error } = await supabase
    .from("member_point_adjustments")
    .upsert(
      {
        user_id: userId,
        season_id: seasonId,
        points: nextPoints,
        last_reason: reason,
      },
      { onConflict: "user_id,season_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await writeAdminAuditLog(supabase, {
    action: "member.points_adjust",
    after: { adjustment: data, delta, reason },
    before,
    entityId: userId,
    entityType: "member_point_adjustment",
  });

  return redirectWithAdminFlash(request, "/admin/members", {
    status: `${profile.display_name}: ${formatSignedPoints(delta)} für ${seasonResult.data.name}. Neue Korrektur: ${formatSignedPoints(nextPoints)}.`,
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

async function assertKeepsActiveAdmin(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  before: ProfileRow,
  after: Pick<ProfileRow, "is_active" | "role"> | null,
) {
  if (!removesActiveAdminAccess(before, after)) {
    return;
  }

  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  if ((count ?? 0) <= 1) {
    throw new Error(LAST_ACTIVE_ADMIN_MESSAGE);
  }
}

function formatSignedPoints(points: number) {
  return `${points > 0 ? "+" : ""}${points} P`;
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
