import { describe, expect, it, vi } from "vitest";
import { hasStravaReadBudget } from "@/lib/strava/rate-limit";
import { fetchStravaActivitySummariesForRange } from "@/lib/strava/resync-pages";

describe("Strava resync pagination", () => {
  it("loads 300 summary activities with three list requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page"));
      const activities = Array.from({ length: 100 }, (_, index) => ({
        id: (page - 1) * 100 + index + 1,
        name: `Ride ${index + 1}`,
        sport_type: "Ride",
        distance: 50000,
        start_date: "2026-07-01T08:00:00Z",
        start_date_local: "2026-07-01T10:00:00",
      }));

      return jsonResponse(activities, rateHeaders(page, page));
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;

    const result = await fetchStravaActivitySummariesForRange({
      accessToken: "token",
      after: 1782864000,
      before: 1785542400,
      fetchImpl,
      maxPages: 3,
      perPage: 100,
    });

    expect(result.activities).toHaveLength(300);
    expect(result.apiRequests).toBe(3);
    expect(result.completionStatus).toBe("partial_page_limit");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/v3/athlete/activities");
      expect(url.searchParams.get("after")).toBe("1782864000");
      expect(url.searchParams.get("before")).toBe("1785542400");
    }
  });

  it("stops before another page when the short-term reserve is reached", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        Array.from({ length: 100 }, (_, id) => ({
          id: id + 1,
          name: `Ride ${id + 1}`,
          start_date: "2026-07-01T08:00:00Z",
        })),
        rateHeaders(285, 1000),
      ),
    ) as unknown as typeof fetch;

    const result = await fetchStravaActivitySummariesForRange({
      accessToken: "token",
      after: 1,
      before: 2,
      fetchImpl,
      maxPages: 3,
      perPage: 100,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.completionStatus).toBe("partial_rate_budget");
    expect(result.activities).toHaveLength(100);
  });

  it("fails closed when rate-limit headers are missing", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([]),
    ) as unknown as typeof fetch;

    const result = await fetchStravaActivitySummariesForRange({
      accessToken: "token",
      after: 1,
      before: 2,
      fetchImpl,
      maxPages: 3,
      perPage: 100,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.completionStatus).toBe("partial_rate_budget");
    expect(result.rateLimitError).toContain("Header fehlen");
  });

  it("does not retry a Strava 429 response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Rate Limit Exceeded" }), {
          status: 429,
          headers: { "retry-after": "60" },
        }),
    ) as unknown as typeof fetch;

    const result = await fetchStravaActivitySummariesForRange({
      accessToken: "token",
      after: 1,
      before: 2,
      fetchImpl,
      maxPages: 3,
      perPage: 100,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.apiRequests).toBe(1);
    expect(result.completionStatus).toBe("partial_rate_budget");
    expect(result.rateLimitError).toContain("Rate-Limit erreicht");
  });
});

describe("Strava rate-limit budget", () => {
  it("uses the stricter read or overall budget", () => {
    expect(
      hasStravaReadBudget({
        overall: {
          shortLimit: 300,
          shortUsage: 100,
          dailyLimit: 3000,
          dailyUsage: 1000,
        },
        read: {
          shortLimit: 200,
          shortUsage: 190,
          dailyLimit: 2000,
          dailyUsage: 1000,
        },
      }),
    ).toBe(false);
  });
});

function rateHeaders(shortUsage: number, dailyUsage: number) {
  return new Headers({
    "x-ratelimit-limit": "300,3000",
    "x-ratelimit-usage": `${shortUsage},${dailyUsage}`,
    "x-readratelimit-limit": "300,3000",
    "x-readratelimit-usage": `${shortUsage},${dailyUsage}`,
  });
}

function jsonResponse(value: unknown, headers?: Headers) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers,
  });
}
