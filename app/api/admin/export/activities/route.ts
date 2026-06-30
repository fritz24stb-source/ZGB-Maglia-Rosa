import { NextResponse, type NextRequest } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { csvResponse } from "@/lib/admin/csv";
import {
  AdminHttpError,
  formatAdminError,
  requireAdminSession,
} from "@/lib/admin/http";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "id"
>;
type SeasonRow = Pick<
  Database["public"]["Tables"]["seasons"]["Row"],
  "id" | "name"
>;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);

    const requestUrl = new URL(request.url);
    const supabase = createSupabaseServiceRoleClient();
    let query = supabase
      .from("activities")
      .select("*")
      .order("activity_started_at", { ascending: false })
      .limit(10000);

    query = applyEqFilter(
      query,
      "season_id",
      requestUrl.searchParams.get("seasonId"),
    );
    query = applyEqFilter(
      query,
      "user_id",
      requestUrl.searchParams.get("memberId"),
    );
    query = applyEqFilter(
      query,
      "source",
      requestUrl.searchParams.get("source"),
    );
    query = applyEqFilter(
      query,
      "status",
      requestUrl.searchParams.get("status"),
    );

    const from = normalizeFilter(requestUrl.searchParams.get("from"));
    const to = normalizeFilter(requestUrl.searchParams.get("to"));

    if (from) {
      query = query.gte("activity_started_at", `${from}T00:00:00.000Z`);
    }

    if (to) {
      query = query.lte("activity_started_at", `${to}T23:59:59.999Z`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const activities = (data ?? []) as ActivityRow[];
    const [profiles, seasons] = await Promise.all([
      loadProfiles(
        supabase,
        activities.map((activity) => activity.user_id),
      ),
      loadSeasons(
        supabase,
        activities.map((activity) => activity.season_id),
      ),
    ]);

    const rows = [
      [
        "ID",
        "Mitglied",
        "Saison",
        "Quelle",
        "Status",
        "Start",
        "Name",
        "Sporttyp",
        "Distanz km",
        "Kategorie",
        "Punkte",
        "Regel",
        "Begruendung",
        "Strava URL",
        "Manueller Kommentar",
      ],
      ...activities.map((activity) => [
        activity.id,
        profiles.get(activity.user_id) ?? activity.user_id,
        seasons.get(activity.season_id) ?? activity.season_id,
        activity.source,
        activity.status,
        activity.activity_started_local_at ?? activity.activity_started_at,
        activity.activity_name,
        activity.sport_type ?? "",
        activity.distance_m === null ? "" : String(activity.distance_m / 1000),
        activity.category ?? "",
        String(activity.points),
        activity.matched_rule_name ?? "",
        activity.scoring_reason ?? "",
        activity.strava_url ?? "",
        activity.manual_comment ?? "",
      ]),
    ];

    await writeAdminAuditLog(supabase, {
      action: "export.activities",
      after: {
        rowCount: activities.length,
        seasonId: requestUrl.searchParams.get("seasonId") ?? null,
        source: requestUrl.searchParams.get("source") ?? null,
        status: requestUrl.searchParams.get("status") ?? null,
        userId: requestUrl.searchParams.get("memberId") ?? null,
      },
      entityId: null,
      entityType: "export",
    });

    return csvResponse(`aktivitaeten-${dateStamp()}.csv`, rows);
  } catch (error) {
    return NextResponse.json(
      { error: formatAdminError(error) },
      { status: error instanceof AdminHttpError ? error.status : 500 },
    );
  }
}

function applyEqFilter<
  Query extends { eq: (column: string, value: string) => Query },
>(query: Query, column: string, value: string | null) {
  const normalized = normalizeFilter(value);

  return normalized ? query.eq(column, normalized) : query;
}

function normalizeFilter(value: string | null) {
  if (!value || value === "all") {
    return null;
  }

  return value;
}

async function loadProfiles(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  userIds: string[],
) {
  const uniqueUserIds = [...new Set(userIds)];

  if (uniqueUserIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueUserIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.display_name,
    ]),
  );
}

async function loadSeasons(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  seasonIds: string[],
) {
  const uniqueSeasonIds = [...new Set(seasonIds)];

  if (uniqueSeasonIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("seasons")
    .select("id, name")
    .in("id", uniqueSeasonIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as SeasonRow[]).map((season) => [season.id, season.name]),
  );
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
