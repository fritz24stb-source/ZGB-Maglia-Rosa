export const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
export const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
export const REQUIRED_STRAVA_SCOPES = ["read", "activity:read_all"] as const;

import {
  formatStravaRateLimitMessage,
  isStravaRateLimitStatus,
} from "@/lib/strava/errors";

type FetchLike = typeof fetch;

export type StravaAthlete = {
  id: number;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
};

export type StravaTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  scope?: string;
  athlete?: StravaAthlete;
};

export type StravaRefreshResponse = Omit<
  StravaTokenResponse,
  "athlete" | "scope"
>;

type BuildAuthorizeUrlInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: readonly string[];
  approvalPrompt?: "auto" | "force";
};

type TokenRequestInput = {
  clientId: string;
  clientSecret: string;
};

type ExchangeCodeInput = TokenRequestInput & {
  code: string;
};

type RefreshTokenInput = TokenRequestInput & {
  refreshToken: string;
};

type RevokeTokenInput = TokenRequestInput & {
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token";
};

export class StravaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "StravaApiError";
  }
}

export function buildStravaAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  scope = REQUIRED_STRAVA_SCOPES,
  approvalPrompt = "auto",
}: BuildAuthorizeUrlInput) {
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", approvalPrompt);
  url.searchParams.set("scope", scope.join(","));
  url.searchParams.set("state", state);

  return url;
}

export function parseStravaScopes(scope: string | null | undefined) {
  return new Set(
    (scope ?? "")
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function hasRequiredStravaScopes(scope: string | null | undefined) {
  const granted = parseStravaScopes(scope);

  return REQUIRED_STRAVA_SCOPES.every((requiredScope) =>
    granted.has(requiredScope),
  );
}

export function hasLegacyStravaScopes(scope: string | null | undefined) {
  const granted = parseStravaScopes(scope);

  return granted.has("read") && granted.has("activity:read");
}

export async function exchangeStravaAuthorizationCode(
  input: ExchangeCodeInput,
  fetchImpl: FetchLike = fetch,
) {
  return postStravaTokenRequest<StravaTokenResponse>(
    {
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
    },
    fetchImpl,
  );
}

export async function refreshStravaToken(
  input: RefreshTokenInput,
  fetchImpl: FetchLike = fetch,
) {
  return postStravaTokenRequest<StravaRefreshResponse>(
    {
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    },
    fetchImpl,
  );
}

export async function revokeStravaToken(
  input: RevokeTokenInput,
  fetchImpl: FetchLike = fetch,
) {
  const body = new URLSearchParams();
  body.set("token", input.token);

  if (input.tokenTypeHint) {
    body.set("token_type_hint", input.tokenTypeHint);
  }

  const credentials = Buffer.from(
    `${input.clientId}:${input.clientSecret}`,
  ).toString("base64");

  const response = await fetchImpl(STRAVA_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw await buildStravaApiError("Strava token revoke failed", response);
  }
}

async function postStravaTokenRequest<T>(
  params: Record<string, string>,
  fetchImpl: FetchLike,
) {
  const response = await fetchImpl(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    throw await buildStravaApiError("Strava token request failed", response);
  }

  return (await response.json()) as T;
}

async function buildStravaApiError(message: string, response: Response) {
  const responseBody = await response.text().catch(() => "");
  const safeMessage = isStravaRateLimitStatus(response.status)
    ? formatStravaRateLimitMessage(response.headers.get("retry-after"))
    : message;

  return new StravaApiError(safeMessage, response.status, responseBody);
}
