export type StravaRateLimitWindow = {
  dailyLimit: number;
  dailyUsage: number;
  shortLimit: number;
  shortUsage: number;
};

export type StravaRateLimitSnapshot = {
  overall: StravaRateLimitWindow;
  read: StravaRateLimitWindow;
};

const MIN_SHORT_RESERVE = 10;
const MIN_DAILY_RESERVE = 100;
const RESERVE_RATIO = 0.05;

export function parseStravaRateLimitHeaders(
  headers: Pick<Headers, "get">,
): StravaRateLimitSnapshot | null {
  const overall = parseWindow(
    headers.get("x-ratelimit-limit"),
    headers.get("x-ratelimit-usage"),
  );
  const read = parseWindow(
    headers.get("x-readratelimit-limit"),
    headers.get("x-readratelimit-usage"),
  );

  return overall && read ? { overall, read } : null;
}

export function hasStravaReadBudget(snapshot: StravaRateLimitSnapshot) {
  return [snapshot.overall, snapshot.read].every((window) => {
    const shortRemaining = window.shortLimit - window.shortUsage;
    const dailyRemaining = window.dailyLimit - window.dailyUsage;
    const shortReserve = Math.max(
      MIN_SHORT_RESERVE,
      Math.ceil(window.shortLimit * RESERVE_RATIO),
    );
    const dailyReserve = Math.max(
      MIN_DAILY_RESERVE,
      Math.ceil(window.dailyLimit * RESERVE_RATIO),
    );

    return shortRemaining > shortReserve && dailyRemaining > dailyReserve;
  });
}

function parseWindow(
  limitHeader: string | null,
  usageHeader: string | null,
): StravaRateLimitWindow | null {
  const limits = parseHeaderPair(limitHeader);
  const usage = parseHeaderPair(usageHeader);

  if (!limits || !usage || limits[0] <= 0 || limits[1] <= 0) {
    return null;
  }

  return {
    shortLimit: limits[0],
    dailyLimit: limits[1],
    shortUsage: usage[0],
    dailyUsage: usage[1],
  };
}

function parseHeaderPair(value: string | null): [number, number] | null {
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((entry) => Number(entry.trim()));

  if (
    parts.length !== 2 ||
    !parts.every((entry) => Number.isInteger(entry) && entry >= 0)
  ) {
    return null;
  }

  return [parts[0], parts[1]];
}
