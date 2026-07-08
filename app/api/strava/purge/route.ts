import { NextResponse, type NextRequest } from "next/server";
import { requireActiveAppUser } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { logError } from "@/lib/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { purgeStravaDataForUser } from "@/lib/strava/data-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();
    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(env.appBaseUrl).origin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const access = await requireActiveAppUser();
    const serviceClient = createSupabaseServiceRoleClient();
    await purgeStravaDataForUser(serviceClient, access.userId);

    const url = new URL("/profile", request.url);
    url.searchParams.set("purged", "1");

    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    logError("strava.purge.failed", error);

    const url = new URL("/profile", request.url);
    url.searchParams.set("error", "purge_failed");

    return NextResponse.redirect(url, { status: 303 });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
