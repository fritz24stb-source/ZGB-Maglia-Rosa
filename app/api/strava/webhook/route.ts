import { after, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { logError } from "@/lib/logger";
import {
  processQueuedStravaWebhookEvent,
  queueStravaWebhookPayload,
} from "@/lib/strava/webhook-processor";
import {
  StravaWebhookValidationError,
  verifyStravaWebhookChallenge,
} from "@/lib/strava/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = getServerEnv();
  const requestUrl = new URL(request.url);
  const verification = verifyStravaWebhookChallenge(
    requestUrl.searchParams,
    env.stravaVerifyToken,
  );

  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error },
      { status: verification.status },
    );
  }

  return NextResponse.json({
    "hub.challenge": verification.challenge,
  });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook JSON payload." },
      { status: 400 },
    );
  }

  try {
    const result = await queueStravaWebhookPayload({ payload });

    if (result.status === "queued") {
      after(async () => {
        try {
          const processingResult = await processQueuedStravaWebhookEvent({
            eventId: result.eventId,
          });

          if (processingResult.status === "failed") {
            logError(
              "strava.webhook.processing.failed",
              processingResult.reason ?? "Strava webhook processing failed.",
            );
          }
        } catch (error) {
          logError("strava.webhook.processing.failed", error);
        }
      });
    }

    return NextResponse.json(
      {
        received: true,
        status: result.status,
        event_id: result.eventId,
        reason: result.reason,
      },
      { status: 200 },
    );
  } catch (error) {
    logError("strava.webhook.failed", error);

    const message =
      error instanceof StravaWebhookValidationError
        ? error.message
        : "Strava webhook processing failed.";

    return NextResponse.json(
      { error: message },
      { status: error instanceof StravaWebhookValidationError ? 400 : 500 },
    );
  }
}
