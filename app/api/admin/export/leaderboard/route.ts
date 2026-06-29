import { NextResponse, type NextRequest } from "next/server";
import { csvResponse } from "@/lib/admin/csv";
import {
  AdminHttpError,
  formatAdminError,
  requireAdminSession,
} from "@/lib/admin/http";
import { toLeaderboardRpcArgs } from "@/lib/leaderboard/query";
import type { LeaderboardRpcRow } from "@/lib/leaderboard/types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type LeaderboardRpcClient = {
  rpc(
    functionName: "get_leaderboard",
    args: ReturnType<typeof toLeaderboardRpcArgs>,
  ): Promise<{
    data: LeaderboardRpcRow[] | null;
    error: Error | null;
  }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);

    const requestUrl = new URL(request.url);
    const seasonId = normalizeFilter(requestUrl.searchParams.get("seasonId"));
    const category = normalizeFilter(requestUrl.searchParams.get("category"));
    const source = normalizeSourceFilter(requestUrl.searchParams.get("source"));
    const sportType = normalizeFilter(requestUrl.searchParams.get("sportType"));
    const memberId = normalizeFilter(requestUrl.searchParams.get("memberId"));
    const from = normalizeFilter(requestUrl.searchParams.get("from"));
    const to = normalizeFilter(requestUrl.searchParams.get("to"));
    const supabase = createSupabaseServiceRoleClient();
    const result = await (supabase as unknown as LeaderboardRpcClient).rpc(
      "get_leaderboard",
      toLeaderboardRpcArgs({
        category,
        from,
        memberId,
        seasonId,
        source,
        sportType,
        to,
      }),
    );

    if (result.error) {
      throw result.error;
    }

    const rows = [
      [
        "Platz",
        "Mitglied",
        "Saison",
        "Punkte",
        "Fahrten",
        "Samstags-Fondo",
        "Mittwoch",
        "Sonderevents",
        "Manuell Punkte",
        "Letzte Aktivitaet",
      ],
      ...(result.data ?? []).map((row) => [
        String(row.place),
        row.display_name,
        row.season_name,
        String(row.total_points),
        String(row.total_rides),
        String(row.samstags_fahrten),
        String(row.mittwochs_fahrten),
        String(row.sonderevents),
        String(row.manual_points),
        row.last_activity_at ?? "",
      ]),
    ];

    return csvResponse(`leaderboard-${dateStamp()}.csv`, rows);
  } catch (error) {
    return NextResponse.json(
      { error: formatAdminError(error) },
      { status: error instanceof AdminHttpError ? error.status : 500 },
    );
  }
}

function normalizeFilter(value: string | null) {
  if (!value || value === "all") {
    return null;
  }

  return value;
}

function normalizeSourceFilter(value: string | null) {
  if (value === "strava" || value === "manual") {
    return value;
  }

  return null;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
