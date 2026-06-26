const DEFAULT_MIN_VALIDITY_SECONDS = 3600;

export function shouldRefreshAccessToken(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
  minValiditySeconds = DEFAULT_MIN_VALIDITY_SECONDS,
) {
  if (!expiresAt) {
    return true;
  }

  const expiresAtMs = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs - now.getTime() <= minValiditySeconds * 1000;
}

export function epochSecondsToIso(expiresAt: number) {
  return new Date(expiresAt * 1000).toISOString();
}
