import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import { syncStravaActivitiesForUser } from "@/lib/strava/admin-sync";
import { formatUserSyncSummary } from "@/lib/strava/sync-summary";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

export async function runAutomaticUserResync(input: {
  client: ServiceClient;
  userId: string;
}) {
  try {
    const summary = await syncStravaActivitiesForUser({
      client: input.client,
      userId: input.userId,
    });

    await insertNotification(input.client, {
      message: formatUserSyncSummary(summary),
      title: "Automatischer User-Resync abgeschlossen",
      type: "strava_auto_resync_completed",
      userId: input.userId,
    });
  } catch (error) {
    logError("strava.automatic_user_resync.failed", error, {
      userId: input.userId,
    });

    try {
      await insertNotification(input.client, {
        message: getErrorMessage(error),
        title: "Automatischer User-Resync fehlgeschlagen",
        type: "strava_auto_resync_failed",
        userId: input.userId,
      });
    } catch (notificationError) {
      logError(
        "strava.automatic_user_resync_notification.failed",
        notificationError,
        { userId: input.userId },
      );
    }
  }
}

async function insertNotification(
  client: ServiceClient,
  input: {
    message: string;
    title: string;
    type: string;
    userId: string;
  },
) {
  const { error } = await client.from("admin_notifications").insert({
    type: input.type,
    title: input.title,
    message: input.message,
    user_id: input.userId,
    activity_id: null,
  });

  if (error) {
    throw error;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
