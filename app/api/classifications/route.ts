import { NextResponse } from "next/server";
import { AppAccessError, requireActiveAppUser } from "@/lib/auth/guards";
import {
  canAccessAzzurra,
  canAccessCiclamino,
} from "@/lib/classifications/access";
import { loadClassificationLeaderboard } from "@/lib/classifications/server";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await requireActiveAppUser();

    const includeCiclamino = canAccessCiclamino(access.profile.role);
    const includeAzzurra = canAccessAzzurra(access.profile.role);

    if (!includeCiclamino && !includeAzzurra) {
      return NextResponse.json(
        { error: "Wertungen sind noch nicht aktiv." },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    return NextResponse.json(
      await loadClassificationLeaderboard(url.searchParams.get("seasonId"), {
        includeAzzurra,
        includeCiclamino,
      }),
    );
  } catch (error) {
    if (error instanceof AppAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logError("classifications.load.failed", error);
    return NextResponse.json(
      { error: "Wertungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
