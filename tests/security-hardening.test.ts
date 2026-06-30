import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLeaderboardResponse } from "@/lib/leaderboard/query";
import { redactSensitiveValue } from "@/lib/security/redaction";
import type { LeaderboardRow } from "@/lib/leaderboard/types";

const workspaceRoot = process.cwd();

describe("security hardening", () => {
  it("redacts token and secret fields before logging or auditing", () => {
    expect(
      redactSensitiveValue({
        action: "member.update",
        nested: {
          access_token: "strava-access",
          clientSecret: "strava-secret",
          refresh_token: "strava-refresh",
        },
        visible: "ok",
      }),
    ).toEqual({
      action: "member.update",
      nested: {
        access_token: "[redacted]",
        clientSecret: "[redacted]",
        refresh_token: "[redacted]",
      },
      visible: "ok",
    });
  });

  it("keeps server-only env helpers out of client modules", () => {
    const clientSource = readFileSync(
      join(workspaceRoot, "lib/supabase/client.ts"),
      "utf8",
    );

    expect(clientSource).toContain("@/lib/env-public");
    expect(clientSource).not.toContain('@/lib/env"');
    expect(readFileSync(join(workspaceRoot, "lib/env.ts"), "utf8")).toContain(
      "server-only",
    );
  });

  it("does not reference Strava tokens or service-role keys in client files", () => {
    const sensitivePattern =
      /access_token|refresh_token|STRAVA_CLIENT_SECRET|SUPABASE_SERVICE_ROLE_KEY/i;

    for (const filePath of findSourceFiles(join(workspaceRoot, "app"))) {
      const source = readFileSync(filePath, "utf8");

      if (source.startsWith('"use client";')) {
        expect(source, filePath).not.toMatch(sensitivePattern);
      }
    }

    for (const filePath of findSourceFiles(join(workspaceRoot, "components"))) {
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(sensitivePattern);
    }
  });

  it("keeps leaderboard responses limited to aggregated ranking fields", () => {
    const response = buildLeaderboardResponse({
      filters: {
        category: null,
        from: null,
        memberId: null,
        seasonId: "season-2026",
        source: null,
        sportType: null,
        to: null,
      },
      generatedAt: new Date("2026-06-30T10:00:00.000Z"),
      options: {
        categories: [],
        seasons: [],
        sources: [],
        sportTypes: [],
      },
      rows: [leaderboardRow()],
      sortDirection: "desc",
      sortKey: "totalPoints",
    });
    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain("activity_name");
    expect(serialized).not.toContain("strava_url");
    expect(serialized).not.toContain("distance_m");
    expect(Object.keys(response.rows[0]).sort()).toEqual(
      [
        "displayName",
        "lastActivityAt",
        "manualPoints",
        "mittwochsFahrten",
        "place",
        "samstagsFahrten",
        "seasonId",
        "seasonName",
        "sonderevents",
        "totalPoints",
        "totalRides",
        "userId",
      ].sort(),
    );
  });
});

function findSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function leaderboardRow(
  overrides: Partial<LeaderboardRow> = {},
): LeaderboardRow {
  return {
    displayName: "Mock Mitglied",
    lastActivityAt: "2026-06-27T08:00:00.000Z",
    manualPoints: 0,
    mittwochsFahrten: 0,
    place: 1,
    samstagsFahrten: 1,
    seasonId: "season-2026",
    seasonName: "Mock Saison 2026",
    sonderevents: 0,
    totalPoints: 100,
    totalRides: 1,
    userId: "user-1",
    ...overrides,
  };
}
