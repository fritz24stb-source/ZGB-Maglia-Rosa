import {
  formatStravaRateLimitMessage,
  isStravaRateLimitStatus,
} from "@/lib/strava/errors";

export const STRAVA_PUSH_SUBSCRIPTIONS_URL =
  "https://www.strava.com/api/v3/push_subscriptions";

type FetchLike = typeof fetch;

export type StravaSubscriptionCredentials = {
  clientId: string;
  clientSecret: string;
};

export type StravaWebhookSubscriptionConfig = StravaSubscriptionCredentials & {
  callbackUrl: string;
  verifyToken: string;
};

export type StravaWebhookSubscription = {
  id: number;
  callback_url: string;
  created_at?: string;
  updated_at?: string;
};

export type EnsureStravaWebhookSubscriptionResult =
  | {
      status: "exists";
      subscription: StravaWebhookSubscription;
    }
  | {
      status: "created";
      subscription: StravaWebhookSubscription;
    }
  | {
      status: "replaced";
      previous: StravaWebhookSubscription[];
      subscription: StravaWebhookSubscription;
    }
  | {
      status: "mismatch";
      subscriptions: StravaWebhookSubscription[];
      expectedCallbackUrl: string;
    };

export class StravaSubscriptionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "StravaSubscriptionApiError";
  }
}

export async function ensureStravaWebhookSubscription(
  config: StravaWebhookSubscriptionConfig,
  options: {
    fetchImpl?: FetchLike;
    replaceMismatched?: boolean;
  } = {},
): Promise<EnsureStravaWebhookSubscriptionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const existingSubscriptions = await listStravaWebhookSubscriptions(
    config,
    fetchImpl,
  );
  const matchingSubscription = existingSubscriptions.find(
    (subscription) =>
      normalizeCallbackUrl(subscription.callback_url) ===
      normalizeCallbackUrl(config.callbackUrl),
  );

  if (matchingSubscription) {
    return {
      status: "exists",
      subscription: matchingSubscription,
    };
  }

  if (existingSubscriptions.length === 0) {
    return {
      status: "created",
      subscription: await createStravaWebhookSubscription(config, fetchImpl),
    };
  }

  if (!options.replaceMismatched) {
    return {
      status: "mismatch",
      subscriptions: existingSubscriptions,
      expectedCallbackUrl: config.callbackUrl,
    };
  }

  for (const subscription of existingSubscriptions) {
    await deleteStravaWebhookSubscription(
      {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      },
      subscription.id,
      fetchImpl,
    );
  }

  return {
    status: "replaced",
    previous: existingSubscriptions,
    subscription: await createStravaWebhookSubscription(config, fetchImpl),
  };
}

export async function listStravaWebhookSubscriptions(
  credentials: StravaSubscriptionCredentials,
  fetchImpl: FetchLike = fetch,
) {
  const url = new URL(STRAVA_PUSH_SUBSCRIPTIONS_URL);
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("client_secret", credentials.clientSecret);

  const response = await fetchImpl(url);

  if (!response.ok) {
    throw await buildStravaSubscriptionApiError(
      "Strava push subscription lookup failed.",
      response,
    );
  }

  return parseSubscriptions(await response.json());
}

export async function createStravaWebhookSubscription(
  config: StravaWebhookSubscriptionConfig,
  fetchImpl: FetchLike = fetch,
) {
  const body = new URLSearchParams();
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("callback_url", config.callbackUrl);
  body.set("verify_token", config.verifyToken);

  const response = await fetchImpl(STRAVA_PUSH_SUBSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw await buildStravaSubscriptionApiError(
      "Strava push subscription creation failed.",
      response,
    );
  }

  return parseSubscription(await response.json(), config.callbackUrl);
}

export async function deleteStravaWebhookSubscription(
  credentials: StravaSubscriptionCredentials,
  subscriptionId: number,
  fetchImpl: FetchLike = fetch,
) {
  const url = new URL(
    `${STRAVA_PUSH_SUBSCRIPTIONS_URL}/${String(subscriptionId)}`,
  );
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("client_secret", credentials.clientSecret);

  const response = await fetchImpl(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw await buildStravaSubscriptionApiError(
      `Strava push subscription delete failed for ${subscriptionId}.`,
      response,
    );
  }
}

function parseSubscriptions(payload: unknown) {
  if (!Array.isArray(payload)) {
    throw new Error("Strava subscription lookup returned no list.");
  }

  return payload.map((entry) => parseSubscription(entry));
}

function parseSubscription(
  payload: unknown,
  fallbackCallbackUrl?: string,
): StravaWebhookSubscription {
  if (!isRecord(payload)) {
    throw new Error("Strava subscription response must be a JSON object.");
  }

  const id = readFiniteInteger(payload.id);

  if (id === null) {
    throw new Error("Strava subscription response did not include a valid id.");
  }

  return {
    id,
    callback_url:
      readOptionalText(payload.callback_url) ?? fallbackCallbackUrl ?? "",
    created_at: readOptionalText(payload.created_at),
    updated_at: readOptionalText(payload.updated_at),
  };
}

async function buildStravaSubscriptionApiError(
  message: string,
  response: Response,
) {
  const responseBody = await response.text().catch(() => "");
  const safeMessage = isStravaRateLimitStatus(response.status)
    ? formatStravaRateLimitMessage(response.headers.get("retry-after"))
    : message;

  return new StravaSubscriptionApiError(
    safeMessage,
    response.status,
    responseBody,
  );
}

function normalizeCallbackUrl(value: string) {
  return value.trim();
}

function readFiniteInteger(value: unknown) {
  const numberValue = typeof value === "string" ? Number(value) : value;

  return typeof numberValue === "number" &&
    Number.isFinite(numberValue) &&
    Number.isInteger(numberValue)
    ? numberValue
    : null;
}

function readOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
