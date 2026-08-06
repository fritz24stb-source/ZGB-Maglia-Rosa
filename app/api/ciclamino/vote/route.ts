import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireActiveAppUser } from "@/lib/auth/guards";
import { CICLAMINO_LOCATIONS } from "@/lib/classifications/ciclamino";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let sprintDate: string | null = null;

  try {
    validateOrigin(request);
    const access = await requireActiveAppUser();
    const formData = await request.formData();
    const seasonId = requiredText(formData, "seasonId");
    sprintDate = requiredDate(formData, "sprintDate");
    const candidateUserId = requiredText(formData, "candidateUserId");
    const results = CICLAMINO_LOCATIONS.map((location, index) => ({
      location,
      place: optionalPlace(formData, `location${index}Place`),
    }));
    const supabase = createSupabaseServiceRoleClient();

    const [{ data: beforeVote, error: voteError }, { data: beforeResults, error: resultsError }] = await Promise.all([
      supabase
        .from("ciclamino_combative_votes")
        .select("*")
        .eq("season_id", seasonId)
        .eq("sprint_date", sprintDate)
        .eq("voter_user_id", access.userId)
        .maybeSingle(),
      supabase
        .from("ciclamino_result_submissions")
        .select("*")
        .eq("season_id", seasonId)
        .eq("sprint_date", sprintDate)
        .eq("user_id", access.userId),
    ]);
    if (voteError ?? resultsError) throw voteError ?? resultsError;

    const { error } = await supabase.rpc("save_ciclamino_member_vote", {
      p_candidate_user_id: candidateUserId,
      p_results: results as Json,
      p_season_id: seasonId,
      p_sprint_date: sprintDate,
      p_voter_user_id: access.userId,
    });
    if (error) throw error;

    await writeAdminAuditLog(supabase, {
      action: beforeVote || beforeResults?.length
        ? "ciclamino.vote.update"
        : "ciclamino.vote.create",
      entityType: "ciclamino_vote",
      entityId: access.userId,
      before: { combativeVote: beforeVote, results: beforeResults },
      after: {
        candidateUserId,
        results,
        seasonId,
        sprintDate,
        voterUserId: access.userId,
      },
    });

    return redirect(request, sprintDate, {
      voteStatus: beforeVote || beforeResults?.length
        ? "Abstimmung geändert."
        : "Abstimmung gespeichert.",
    });
  } catch (error) {
    return redirect(request, sprintDate, { voteError: errorMessage(error) });
  }
}

function validateOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_BASE_URL ?? request.url).origin;
  if (origin && origin !== expected) throw new Error("Ungültiger Request-Origin.");
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

function optionalPlace(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) return null;
  if (!/^[1-5]$/.test(value)) throw new Error("Ungültige Platzierung.");
  return Number(value);
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    return "Mindestens einer der gewählten Plätze wurde inzwischen von einem anderen Mitglied belegt. Bitte Auswahl aktualisieren.";
  }
  return error instanceof Error ? error.message : "Abstimmung konnte nicht gespeichert werden.";
}

function redirect(
  request: NextRequest,
  sprintDate: string | null,
  flash: { voteError?: string; voteStatus?: string },
) {
  const url = new URL("/ciclamino/vote", request.url);
  if (sprintDate) url.searchParams.set("sprintDate", sprintDate);
  if (flash.voteError) url.searchParams.set("voteError", flash.voteError);
  if (flash.voteStatus) url.searchParams.set("voteStatus", flash.voteStatus);
  return NextResponse.redirect(url, { status: 303 });
}
