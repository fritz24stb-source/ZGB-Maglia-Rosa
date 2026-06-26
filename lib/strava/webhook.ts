import type { Json } from "@/types/database";

export type StravaWebhookAspectType = "create" | "update" | "delete";
export type StravaWebhookObjectType = "activity" | "athlete";

export type StravaWebhookEvent = {
  object_type: StravaWebhookObjectType | string;
  object_id: number;
  aspect_type: StravaWebhookAspectType | string;
  owner_id: number;
  event_time: number;
  subscription_id?: number;
  updates?: Record<string, Json>;
};

export type WebhookVerificationResult =
  | {
      ok: true;
      challenge: string;
    }
  | {
      ok: false;
      status: 400 | 403;
      error: string;
    };

export class StravaWebhookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StravaWebhookValidationError";
  }
}

export function verifyStravaWebhookChallenge(
  searchParams: URLSearchParams,
  verifyToken: string,
): WebhookVerificationResult {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe") {
    return {
      ok: false,
      status: 400,
      error: "Invalid webhook mode.",
    };
  }

  if (token !== verifyToken) {
    return {
      ok: false,
      status: 403,
      error: "Invalid webhook verify token.",
    };
  }

  if (!challenge) {
    return {
      ok: false,
      status: 400,
      error: "Missing webhook challenge.",
    };
  }

  return {
    ok: true,
    challenge,
  };
}

export function parseStravaWebhookEvent(payload: unknown): StravaWebhookEvent {
  if (!isRecord(payload)) {
    throw new StravaWebhookValidationError(
      "Webhook payload must be a JSON object.",
    );
  }

  return {
    object_type: readRequiredText(payload, "object_type").toLowerCase(),
    object_id: readRequiredInteger(payload, "object_id"),
    aspect_type: readRequiredText(payload, "aspect_type").toLowerCase(),
    owner_id: readRequiredInteger(payload, "owner_id"),
    event_time: readRequiredInteger(payload, "event_time"),
    subscription_id: readOptionalInteger(payload, "subscription_id"),
    updates: readOptionalRecord(payload, "updates"),
  };
}

export function webhookEventTimeToIso(eventTime: number) {
  const eventDate = new Date(eventTime * 1000);

  if (Number.isNaN(eventDate.getTime())) {
    throw new StravaWebhookValidationError("Invalid webhook event_time.");
  }

  return eventDate.toISOString();
}

export function isActivityFetchEvent(event: StravaWebhookEvent) {
  return (
    event.object_type === "activity" &&
    (event.aspect_type === "create" || event.aspect_type === "update")
  );
}

export function isActivityDeleteEvent(event: StravaWebhookEvent) {
  return event.object_type === "activity" && event.aspect_type === "delete";
}

export function isStravaDeauthorizationEvent(event: StravaWebhookEvent) {
  return (
    event.object_type === "athlete" &&
    event.aspect_type === "update" &&
    event.updates?.authorized === "false"
  );
}

function readRequiredText(payload: Record<string, unknown>, fieldName: string) {
  const value = payload[fieldName];

  if (typeof value !== "string" || !value.trim()) {
    throw new StravaWebhookValidationError(
      `Webhook payload field '${fieldName}' must be a non-empty string.`,
    );
  }

  return value.trim();
}

function readRequiredInteger(
  payload: Record<string, unknown>,
  fieldName: string,
) {
  const value = readIntegerValue(payload[fieldName]);

  if (value === null) {
    throw new StravaWebhookValidationError(
      `Webhook payload field '${fieldName}' must be an integer.`,
    );
  }

  return value;
}

function readOptionalInteger(
  payload: Record<string, unknown>,
  fieldName: string,
) {
  if (payload[fieldName] === undefined || payload[fieldName] === null) {
    return undefined;
  }

  return readRequiredInteger(payload, fieldName);
}

function readOptionalRecord(
  payload: Record<string, unknown>,
  fieldName: string,
) {
  const value = payload[fieldName];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new StravaWebhookValidationError(
      `Webhook payload field '${fieldName}' must be an object.`,
    );
  }

  return value as Record<string, Json>;
}

function readIntegerValue(value: unknown) {
  const numericValue =
    typeof value === "string" && value.trim() ? Number(value) : value;

  if (
    typeof numericValue !== "number" ||
    !Number.isFinite(numericValue) ||
    !Number.isInteger(numericValue)
  ) {
    return null;
  }

  return numericValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
