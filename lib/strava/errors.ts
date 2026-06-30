export function isStravaRateLimitStatus(status: number) {
  return status === 429;
}

export function isStravaRateLimitError(error: unknown) {
  return (
    error instanceof Error && (error as { status?: unknown }).status === 429
  );
}

export function formatStravaRateLimitMessage(retryAfter: string | null) {
  const retryHint = formatRetryAfter(retryAfter);

  return retryHint
    ? `Strava Rate-Limit erreicht. Bitte Sync spaeter erneut ausfuehren (${retryHint}).`
    : "Strava Rate-Limit erreicht. Bitte Sync spaeter erneut ausfuehren.";
}

function formatRetryAfter(retryAfter: string | null) {
  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds) && seconds > 0) {
    return `Retry-After: ca. ${Math.ceil(seconds)} Sekunden`;
  }

  return `Retry-After: ${retryAfter}`;
}
