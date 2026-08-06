import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { requireActiveAppUser } from "@/lib/auth/guards";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    validateOrigin(request);
    const access = await requireActiveAppUser();
    const formData = await request.formData();
    const seasonId = requiredText(formData, "seasonId");
    const sprintDate = requiredDate(formData, "sprintDate");
    const candidateUserId = requiredText(formData, "candidateUserId");
    const supabase = createSupabaseServiceRoleClient();
    const [{ data: votingWindow, error: windowError }, { data: candidate, error: candidateError }, { data: before, error: beforeError }] = await Promise.all([
      supabase.from("ciclamino_combative_voting_windows").select("*").eq("season_id", seasonId).eq("sprint_date", sprintDate).maybeSingle(),
      supabase.from("profiles").select("id").eq("id", candidateUserId).eq("is_active", true).maybeSingle(),
      supabase.from("ciclamino_combative_votes").select("*").eq("season_id", seasonId).eq("sprint_date", sprintDate).eq("voter_user_id", access.userId).maybeSingle(),
    ]);
    if (windowError ?? candidateError ?? beforeError) throw windowError ?? candidateError ?? beforeError;
    if (!votingWindow) throw new Error("Für diesen Sprinttag ist keine Abstimmung eingerichtet.");
    const now = new Date();
    if (now < new Date(votingWindow.opens_at) || now >= new Date(votingWindow.closes_at)) throw new Error("Die Abstimmung ist derzeit nicht geöffnet.");
    if (!candidate) throw new Error("Der ausgewählte Fahrer ist nicht aktiv.");

    const { error } = await supabase.from("ciclamino_combative_votes").upsert({
      candidate_user_id: candidateUserId,
      season_id: seasonId,
      sprint_date: sprintDate,
      voter_user_id: access.userId,
    });
    if (error) throw error;
    await writeAdminAuditLog(supabase, {
      action: before ? "ciclamino.combative_vote.update" : "ciclamino.combative_vote.create",
      entityType: "ciclamino_combative_vote",
      entityId: access.userId,
      before,
      after: { candidateUserId, seasonId, sprintDate, voterUserId: access.userId },
    });
    return redirect(request, sprintDate, { voteStatus: before ? "Stimme geändert." : "Stimme gespeichert." });
  } catch (error) {
    return redirect(request, null, { voteError: error instanceof Error ? error.message : "Stimme konnte nicht gespeichert werden." });
  }
}

function validateOrigin(request: NextRequest) { const origin = request.headers.get("origin"); const expected = new URL(process.env.APP_BASE_URL ?? request.url).origin; if (origin && origin !== expected) throw new Error("Ungültiger Request-Origin."); }
function requiredText(formData: FormData, key: string) { const value = formData.get(key); if (typeof value !== "string" || !value.trim()) throw new Error(`${key} fehlt.`); return value.trim(); }
function requiredDate(formData: FormData, key: string) { const value = requiredText(formData, key); if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ungültiges Datum."); return value; }
function redirect(request: NextRequest, sprintDate: string | null, flash: { voteError?: string; voteStatus?: string }) { const url = new URL("/ciclamino/vote", request.url); if (sprintDate) url.searchParams.set("sprintDate", sprintDate); if (flash.voteError) url.searchParams.set("voteError", flash.voteError); if (flash.voteStatus) url.searchParams.set("voteStatus", flash.voteStatus); return NextResponse.redirect(url, { status: 303 }); }
