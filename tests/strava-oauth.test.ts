import { describe, expect, it } from "vitest";
import {
  buildStravaAuthorizeUrl,
  hasRequiredStravaScopes,
  parseStravaScopes,
} from "@/lib/strava/oauth";
import {
  epochSecondsToIso,
  shouldRefreshAccessToken,
} from "@/lib/strava/token-policy";

describe("strava oauth helpers", () => {
  it("builds the web oauth authorize url with required scopes", () => {
    const url = buildStravaAuthorizeUrl({
      clientId: "12345",
      redirectUri: "https://example.test/api/strava/callback",
      state: "abc",
    });

    expect(url.origin).toBe("https://www.strava.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("12345");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("read,activity:read");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("accepts comma and space separated scope strings", () => {
    expect([...parseStravaScopes("read activity:read")]).toEqual([
      "read",
      "activity:read",
    ]);
    expect(hasRequiredStravaScopes("read,activity:read")).toBe(true);
    expect(hasRequiredStravaScopes("read")).toBe(false);
  });
});

describe("strava token refresh policy", () => {
  const now = new Date("2026-06-26T10:00:00.000Z");

  it("refreshes missing, invalid or nearly expired tokens", () => {
    expect(shouldRefreshAccessToken(null, now)).toBe(true);
    expect(shouldRefreshAccessToken("not-a-date", now)).toBe(true);
    expect(shouldRefreshAccessToken("2026-06-26T10:59:59.000Z", now)).toBe(
      true,
    );
  });

  it("keeps access tokens with more than one hour validity", () => {
    expect(shouldRefreshAccessToken("2026-06-26T11:00:01.000Z", now)).toBe(
      false,
    );
  });

  it("converts Strava epoch seconds to ISO timestamps", () => {
    expect(epochSecondsToIso(1782468000)).toBe("2026-06-26T10:00:00.000Z");
  });
});
