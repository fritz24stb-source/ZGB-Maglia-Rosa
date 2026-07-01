import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { logError } from "@/lib/logger";
import { processPendingStravaWebhookEvents } from "@/lib/strava/webhook-processor";
import { syncStravaActivitiesForActiveUsers } from "@/lib/strava/admin-sync";
import { ensureStravaWebhookSubscription } from "@/lib/strava/subscription";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WEBHOOK_EVENT_BATCH_LIMIT = 25;
const BACKFILL_MAX_PAGES = 1;
const BACKFILL_PER_PAGE = 10;

export async function GET(request: NextRequest) {
  const cronAuth = validateCronRequest(request);

  if (!cronAuth.ok) {
    return NextResponse.json({ error: cronAuth.error }, { status: 401 });
  }

  try {
    const env = getServerEnv();
    const supabase = createSupabaseServiceRoleClient();
    const subscription = await ensureStravaWebhookSubscription(
      {
        clientId: env.stravaClientId,
        clientSecret: env.stravaClientSecret,
        callbackUrl: env.stravaWebhookCallbackUrl,
        verifyToken: env.stravaVerifyToken,
      },
      {
        replaceMismatched: true,
      },
    );
    const webhookEvents = await processPendingStravaWebhookEvents({
      client: supabase,
      limit: WEBHOOK_EVENT_BATCH_LIMIT,
    });
    const activeSeasonId = await findActiveSeasonId(supabase);
    const backfill = activeSeasonId
      ? await syncStravaActivitiesForActiveUsers({
          client: supabase,
          maxPages: BACKFILL_MAX_PAGES,
          perPage: BACKFILL_PER_PAGE,
          seasonId: activeSeasonId,
        })
      : null;

    return NextResponse.json({
      success: true,
      subscription,
      webhookEvents,
      activeSeasonId,
      backfill,
    });
  } catch (error) {
    logError("strava.cron.failed", error);

    return NextResponse.json(
      {
        success: false,
        error: formatCronError(error),
      },
      { status: 500 },
    );
  }
}

function validateCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      ok: false as const,
      error: "CRON_SECRET is not configured.",
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return {
      ok: false as const,
      error: "Unauthorized cron request.",
    };
  }

  return { ok: true as const };
}

async function findActiveSeasonId(
  client: ReturnType<typeof createSupabaseServiceRoleClient>,
) {
  const { data, error } = await client
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

function formatCronError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
