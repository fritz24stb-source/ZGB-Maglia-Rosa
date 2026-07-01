import { describe, expect, it } from "vitest";
import { ensureStravaWebhookSubscription } from "@/lib/strava/subscription";

const config = {
  clientId: "123",
  clientSecret: "secret",
  callbackUrl: "https://example.test/api/strava/webhook",
  verifyToken: "verify-token",
};

describe("strava webhook subscription", () => {
  it("keeps an existing subscription with the configured callback url", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init });

      return Response.json([
        {
          id: 100,
          callback_url: config.callbackUrl,
        },
      ]);
    };

    await expect(
      ensureStravaWebhookSubscription(config, { fetchImpl }),
    ).resolves.toEqual({
      status: "exists",
      subscription: {
        id: 100,
        callback_url: config.callbackUrl,
        created_at: undefined,
        updated_at: undefined,
      },
    });
    expect(calls).toHaveLength(1);
  });

  it("creates a subscription when none exists", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init });

      if (calls.length === 1) {
        return Response.json([]);
      }

      return Response.json({ id: 101 });
    };

    const result = await ensureStravaWebhookSubscription(config, {
      fetchImpl,
    });

    expect(result).toEqual({
      status: "created",
      subscription: {
        id: 101,
        callback_url: config.callbackUrl,
        created_at: undefined,
        updated_at: undefined,
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.init?.method).toBe("POST");
    expect(String(calls[1]?.init?.body)).toContain(
      `callback_url=${encodeURIComponent(config.callbackUrl)}`,
    );
  });

  it("replaces a mismatched subscription when requested", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init });

      if (calls.length === 1) {
        return Response.json([
          {
            id: 100,
            callback_url: "https://old.example.test/api/strava/webhook",
          },
        ]);
      }

      if (calls.length === 2) {
        return new Response(null, { status: 204 });
      }

      return Response.json({ id: 102 });
    };

    const result = await ensureStravaWebhookSubscription(config, {
      fetchImpl,
      replaceMismatched: true,
    });

    expect(result).toMatchObject({
      status: "replaced",
      previous: [
        {
          id: 100,
          callback_url: "https://old.example.test/api/strava/webhook",
        },
      ],
      subscription: {
        id: 102,
        callback_url: config.callbackUrl,
      },
    });
    expect(calls.map((call) => call.init?.method ?? "GET")).toEqual([
      "GET",
      "DELETE",
      "POST",
    ]);
  });
});
