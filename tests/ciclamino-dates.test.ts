import { describe, expect, it } from "vitest";
import {
  defaultSeasonWednesday,
  listSeasonWednesdays,
  todayInZurich,
} from "@/lib/classifications/ciclamino";

describe("Ciclamino Wednesdays", () => {
  const season = { startsOn: "2026-08-01", endsOn: "2026-08-31" };

  it("lists every Wednesday inside the season", () => {
    expect(listSeasonWednesdays(season)).toEqual([
      "2026-08-05",
      "2026-08-12",
      "2026-08-19",
      "2026-08-26",
    ]);
  });

  it("selects the current or previous Wednesday", () => {
    expect(defaultSeasonWednesday(season, "2026-08-19")).toBe("2026-08-19");
    expect(defaultSeasonWednesday(season, "2026-08-22")).toBe("2026-08-19");
  });

  it("clamps the default to the season", () => {
    expect(defaultSeasonWednesday(season, "2026-07-01")).toBe("2026-08-05");
    expect(defaultSeasonWednesday(season, "2026-09-10")).toBe("2026-08-26");
  });

  it("formats today in the Swiss timezone", () => {
    expect(todayInZurich(new Date("2026-08-05T22:30:00.000Z"))).toBe("2026-08-06");
  });
});
