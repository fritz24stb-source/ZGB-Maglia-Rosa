import { describe, expect, it, vi } from "vitest";
import { loadAllPages } from "@/lib/admin/pagination";

describe("admin activity pagination", () => {
  it("loads every activity beyond the first page", async () => {
    const activities = Array.from({ length: 300 }, (_, index) => ({
      id: `activity-${index + 1}`,
    }));
    const fetchPage = vi.fn(async ({ from, to }) => ({
      data: activities.slice(from, to + 1),
      error: null,
    }));

    const result = await loadAllPages({
      fetchPage,
      pageSize: 100,
    });

    expect(result).toEqual(activities);
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(fetchPage).toHaveBeenLastCalledWith({ from: 300, to: 399 });
  });

  it("stops after a partial page", async () => {
    const fetchPage = vi.fn(async ({ from, to }) => ({
      data: [{ from, to }],
      error: null,
    }));

    await expect(loadAllPages({ fetchPage, pageSize: 100 })).resolves.toEqual([
      { from: 0, to: 99 },
    ]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("propagates database errors", async () => {
    const databaseError = new Error("database unavailable");

    await expect(
      loadAllPages({
        fetchPage: async () => ({ data: null, error: databaseError }),
      }),
    ).rejects.toBe(databaseError);
  });
});
