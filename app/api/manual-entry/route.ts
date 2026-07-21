import { NextResponse } from "next/server";
import { AppAccessError, requireActiveAppUser } from "@/lib/auth/guards";
import { getAppBaseUrl } from "@/lib/env";
import { logError } from "@/lib/logger";
import { loadManualEntryEvaluation } from "@/lib/manual-entry/server";
import { parseManualLocalDateTime } from "@/lib/manual-entry/time";
import type { ManualEntryContext } from "@/lib/manual-entry/types";
import { scoreActivity, toActivityScoreUpdate } from "@/lib/scoring";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ManualEntryPayload = {
  ruleId?: unknown;
  activityStartedLocal?: unknown;
  comment?: unknown;
  distanceKm?: unknown;
  sportType?: unknown;
};

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];

const MAX_COMMENT_LENGTH = 500;
const MAX_DISTANCE_KM = 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await requireActiveAppUser();
    const serviceClient = createSupabaseServiceRoleClient();
    const evaluation = await loadManualEntryEvaluation(serviceClient, {
      userId: access.userId,
    });

    return NextResponse.json(evaluation.state);
  } catch (error) {
    if (error instanceof AppAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logError("manual_entry.load.failed", error);

    return NextResponse.json(
      { kind: "unconfigured", message: formatManualEntryError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const access = await requireActiveAppUser();

    const now = new Date();
    const payload = await readPayload(request);

    const input = normalizeManualEntryPayload(payload);
    const serviceClient = createSupabaseServiceRoleClient();
    const evaluation = await loadManualEntryEvaluation(
      serviceClient,
      { userId: access.userId },
      now,
    );

    if (evaluation.kind !== "ready") {
      throw new HttpError(409, evaluation.state.reason);
    }

    const profile = evaluation.profile;

    if (!profile) {
      throw new HttpError(403, "Aktives Mitgliederprofil fehlt.");
    }

    const context = evaluation.contexts.find(
      (option) => option.ruleId === input.ruleId,
    );

    if (!context) {
      throw new HttpError(400, "Ungültige manuelle Kategorie.");
    }

    ensureContextCanBeSubmitted(context);

    const localActivityTime = parseManualLocalDateTime(
      input.activityStartedLocal,
      context.timeZone,
    );

    if (!localActivityTime) {
      throw new HttpError(400, "Ungültiger Aktivitätszeitpunkt.");
    }

    if (
      localActivityTime.localDate < evaluation.season.starts_on ||
      localActivityTime.localDate > evaluation.season.ends_on
    ) {
      throw new HttpError(
        400,
        "Aktivitätszeitpunkt liegt außerhalb der aktiven Saison.",
      );
    }

    if (
      localActivityTime.utcDate.getTime() >
      now.getTime() + FUTURE_TOLERANCE_MS
    ) {
      throw new HttpError(
        400,
        "Aktivitätszeitpunkt darf nicht in der Zukunft liegen.",
      );
    }

    const activityDraft = {
      id: "manual-draft",
      season_id: evaluation.season.id,
      source: "manual" as const,
      activity_name: buildManualActivityName(context),
      sport_type: input.sportType,
      distance_m: input.distanceM,
      activity_started_at: localActivityTime.utcDate.toISOString(),
      activity_started_local_at: localActivityTime.localIsoWithOffset,
      status: "active" as const,
      manually_entered: true,
    };
    const score = scoreActivity(activityDraft, [context.rule], {
      scoredAt: now,
    });

    if (score.matchedRuleId !== context.rule.id || score.points <= 0) {
      throw new HttpError(
        400,
        "Aktivität passt nicht zur gewählten Wertungsregel.",
      );
    }

    const activityInsert: ActivityInsert = {
      user_id: profile.id,
      season_id: evaluation.season.id,
      strava_activity_id: null,
      source: "manual",
      activity_name: activityDraft.activity_name,
      sport_type: input.sportType,
      distance_m: input.distanceM,
      activity_started_at: localActivityTime.utcDate.toISOString(),
      activity_started_local_at: localActivityTime.localIsoWithOffset,
      uploaded_or_created_at: now.toISOString(),
      status: "active",
      manually_entered: true,
      manual_comment: input.comment,
      manual_entry_key: context.manualEntryKey,
      strava_url: null,
      ...toActivityScoreUpdate(score),
    };
    const { data: activity, error: activityError } = await serviceClient
      .from("activities")
      .insert(activityInsert)
      .select("id, points")
      .single();

    if (activityError) {
      if (isUniqueViolation(activityError)) {
        throw new HttpError(
          409,
          "Eintrag für dieses Zeitfenster ist bereits vorhanden.",
        );
      }

      throw activityError;
    }

    const notificationResult = await serviceClient
      .from("admin_notifications")
      .insert({
        type: "manual_entry_created",
        title: `Manuelle Eingabe: ${context.label}`,
        message: buildAdminNotificationMessage({
          comment: input.comment,
          context,
          localActivityTime: localActivityTime.inputValue,
          points: score.points,
          profileName: profile.display_name,
        }),
        user_id: profile.id,
        activity_id: activity.id,
      });

    if (notificationResult.error) {
      throw notificationResult.error;
    }

    const updatedEvaluation = await loadManualEntryEvaluation(
      serviceClient,
      { profile },
      now,
    );

    return NextResponse.json({
      activityId: activity.id,
      points: score.points,
      message: "Manuelle Aktivität wurde erfasst.",
      state: updatedEvaluation.state,
    });
  } catch (error) {
    if (error instanceof AppAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const status = error instanceof HttpError ? error.status : 500;

    if (!(error instanceof HttpError)) {
      logError("manual_entry.submit.failed", error);
    }

    return NextResponse.json(
      { error: formatManualEntryError(error) },
      { status },
    );
  }
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const expectedOrigin = new URL(getAppBaseUrl()).origin;

  if (origin !== expectedOrigin) {
    throw new HttpError(403, "Invalid request origin.");
  }
}

async function readPayload(request: Request): Promise<ManualEntryPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as ManualEntryPayload;
  }

  const formData = await request.formData();

  return {
    ruleId: formData.get("ruleId"),
    activityStartedLocal: formData.get("activityStartedLocal"),
    comment: formData.get("comment"),
    distanceKm: formData.get("distanceKm"),
    sportType: formData.get("sportType"),
  };
}

function normalizeManualEntryPayload(payload: ManualEntryPayload) {
  const ruleId = normalizeRequiredText(payload.ruleId, "Kategorie fehlt.");
  const activityStartedLocal = normalizeRequiredText(
    payload.activityStartedLocal,
    "Aktivitätszeitpunkt fehlt.",
  );
  const comment = normalizeOptionalText(payload.comment);
  const sportType = normalizeOptionalText(payload.sportType) ?? "Ride";
  const distanceM = normalizeDistanceM(payload.distanceKm);

  if (comment && comment.length > MAX_COMMENT_LENGTH) {
    throw new HttpError(
      400,
      `Kommentar darf maximal ${MAX_COMMENT_LENGTH} Zeichen lang sein.`,
    );
  }

  return {
    ruleId,
    activityStartedLocal,
    comment,
    sportType,
    distanceM,
  };
}

function ensureContextCanBeSubmitted(context: ManualEntryContext) {
  if (context.status === "closed") {
    throw new HttpError(409, "Zeitfenster ist geschlossen.");
  }

  if (context.status === "used" || context.remainingEntries <= 0) {
    throw new HttpError(
      409,
      "Eintrag für dieses Zeitfenster ist bereits vorhanden.",
    );
  }
}

function buildManualActivityName(context: ManualEntryContext) {
  const parts = [
    "Manuelle Eingabe",
    context.rule.name,
    ...context.rule.name_keywords.filter(isPositiveNameKeyword),
  ];

  return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].join(
    " ",
  );
}

function isPositiveNameKeyword(keyword: string) {
  return !/^(?:!\s*|kein\s+)/i.test(keyword.trim());
}

function buildAdminNotificationMessage(input: {
  comment: string | null;
  context: ManualEntryContext;
  localActivityTime: string;
  points: number;
  profileName: string;
}) {
  const baseMessage = `${input.profileName} hat ${input.context.label} für ${input.localActivityTime} manuell eingetragen (${input.points} Punkte).`;

  if (!input.comment) {
    return baseMessage;
  }

  return `${baseMessage} Kommentar: ${input.comment}`;
}

function normalizeRequiredText(value: unknown, errorMessage: string) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw new HttpError(400, errorMessage);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDistanceM(value: unknown) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const distanceKm = Number(normalized.replace(",", "."));

  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0 ||
    distanceKm > MAX_DISTANCE_KM
  ) {
    throw new HttpError(
      400,
      `Distanz muss zwischen 0 und ${MAX_DISTANCE_KM} km liegen.`,
    );
  }

  return Math.round(distanceKm * 1000);
}

function isUniqueViolation(error: { code?: string }) {
  return error.code === "23505";
}

function formatManualEntryError(error: unknown) {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
  ) {
    return [
      "Supabase ist lokal noch nicht konfiguriert.",
      "Bitte .env.local auf Basis von .env.example setzen.",
    ].join(" ");
  }

  return "Manuelle Eingabe konnte nicht verarbeitet werden. Details stehen im Server-Log.";
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
