// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  audit: vi.fn(),
  authorize: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ from: mocks.from }),
}));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAuditLog: mocks.audit }));
vi.mock("@/lib/admin/http", () => ({
  requireAdminSession: mocks.authorize,
  formatAdminError: () => "Export fehlgeschlagen",
  AdminHttpError: class extends Error {},
}));

import { GET } from "@/app/api/admin/export/activities/route";

describe("activities CSV export", () => {
  beforeEach(() => vi.clearAllMocks());

  function setup(count: number, serverCap = 500) {
    const activities = Array.from({ length: count }, (_, index) => ({
      id: `activity-${index}`,
      user_id: "member-1",
      season_id: "season-1",
      source: "manual",
      status: "scored",
      activity_started_at: "2026-10-01T12:00:00Z",
      activity_name: `Ride ${index}`,
      distance_m: 10000,
      points: 10,
    }));
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      range: vi.fn(async (from: number, to: number) => ({
        data: activities.slice(from, Math.min(to + 1, from + serverCap)),
        error: null,
      })),
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === "activities") return query;
      return {
        select: () => ({
          in: async () => ({
            data:
              table === "profiles"
                ? [{ id: "member-1", display_name: "Test Member" }]
                : [{ id: "season-1", name: "Test Season" }],
            error: null,
          }),
        }),
      };
    });
    return query;
  }

  it.each([0, 1000, 1251, 10001])("exports all %i rows", async (count) => {
    setup(count);
    const response = await GET(
      new NextRequest("http://localhost/api/admin/export/activities"),
    );
    const lines = (await response.text()).trimEnd().split("\r\n");
    expect(response.status).toBe(200);
    expect(lines).toHaveLength(count + 1);
    expect(new Set(lines.slice(1))).toHaveLength(count);
    if (count)
      expect(lines.at(-1)).toContain(
        `activity-${count - 1};Test Member;Test Season;`,
      );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        after: expect.objectContaining({ rowCount: count }),
      }),
    );
  });

  it("retains filters and handles server caps smaller than the page size", async () => {
    const query = setup(1101, 200);
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/export/activities?seasonId=season-1&memberId=member-1&source=manual&status=scored&from=2026-10-01&to=2026-10-23",
      ),
    );
    expect((await response.text()).trimEnd().split("\r\n")).toHaveLength(1102);
    expect(query.eq.mock.calls).toEqual([
      ["season_id", "season-1"],
      ["user_id", "member-1"],
      ["source", "manual"],
      ["status", "scored"],
    ]);
    expect(query.gte).toHaveBeenCalledWith(
      "activity_started_at",
      "2026-10-01T00:00:00.000Z",
    );
    expect(query.lte).toHaveBeenCalledWith(
      "activity_started_at",
      "2026-10-23T23:59:59.999Z",
    );
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(query.range.mock.calls[1][0]).toBe(200);
  });

  it("fails instead of returning a truncated CSV when a later page fails", async () => {
    const query = setup(1200);
    query.range
      .mockImplementationOnce(query.range.getMockImplementation()!)
      .mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await GET(
      new NextRequest("http://localhost/api/admin/export/activities"),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
