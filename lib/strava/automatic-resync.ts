import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import {
  syncStravaActivitiesForUser,
  type AdminSyncSummary,
} from "@/lib/strava/admin-sync";
import {
  formatUserSyncNotificationMessage,
  formatUserSyncSummary,
  isCompletedSync,
} from "@/lib/strava/sync-summary";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

export async function runAutomaticUserResync(input: {
  client: ServiceClient;
  userId: string;
  userName: string;
}) {
  try {
    const activeSeasonId = await findActiveSeasonId(input.client);
    const summary = activeSeasonId
      ? await syncStravaActivitiesForUser({
          client: input.client,
          seasonId: activeSeasonId,
          userId: input.userId,
        })
      : noActiveSeasonSummary();

    await insertNotification(input.client, {
      message: formatUserSyncNotificationMessage(
        input.userName,
        formatUserSyncSummary(summary),
      ),
      title: isCompletedSync(summary)
        ? "Automatischer User-Resync abgeschlossen"
        : "Automatischer User-Resync unvollständig",
      type: "strava_auto_resync_completed",
      userId: input.userId,
    });
  } catch (error) {
    logError("strava.automatic_user_resync.failed", error, {
      userId: input.userId,
    });

    try {
      await insertNotification(input.client, {
        message: formatUserSyncNotificationMessage(
          input.userName,
          getErrorMessage(error),
        ),
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

async function findActiveSeasonId(client: ServiceClient) {
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

function noActiveSeasonSummary(): AdminSyncSummary {
  return {
    activitiesFetched: 0,
    apiRequests: 0,
    completionStatus: "no_active_season",
    errors: [],
    failed: 0,
    scored: 0,
    skipped: 1,
    synced: 0,
    users: 1,
  };
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
