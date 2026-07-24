import { NextResponse } from "next/server";
import { AppAccessError, requireActiveAppUser } from "@/lib/auth/guards";
import { loadLeaderboardResponse } from "@/lib/leaderboard/server";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireActiveAppUser();

    const requestUrl = new URL(request.url);
    const response = await loadLeaderboardResponse(requestUrl.searchParams);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AppAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logError("leaderboard.load.failed", error);

    return NextResponse.json(
      { error: formatLeaderboardError(error) },
      { status: 500 },
    );
  }
}

function formatLeaderboardError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return [
      "Supabase ist lokal noch nicht konfiguriert.",
      "Bitte .env.local auf Basis von .env.example setzen.",
    ].join(" ");
  }

  return "Leaderboard konnte nicht geladen werden. Details stehen im Server-Log.";
}
