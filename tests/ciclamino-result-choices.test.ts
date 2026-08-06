import { describe, expect, it } from "vitest";
import { availableCiclaminoPlaces } from "@/lib/classifications/ciclamino-vote";

describe("Ciclamino result choices", () => {
  it("offers only places that no other member has occupied", () => {
    const choices = [
      { location: "Okel", place: 1, userId: "other-a" },
      { location: "Okel", place: 3, userId: "other-b" },
      { location: "Heiligenfelde I", place: 2, userId: "other-c" },
    ];

    expect(availableCiclaminoPlaces(choices, "Okel", "current")).toEqual([2, 4, 5]);
  });

  it("keeps the current member's own place selectable while editing", () => {
    const choices = [
      { location: "Okel", place: 2, userId: "current" },
      { location: "Okel", place: 4, userId: "other" },
    ];

    expect(availableCiclaminoPlaces(choices, "Okel", "current")).toEqual([1, 2, 3, 5]);
  });

  it("does not block a place at another location", () => {
    const choices = [
      { location: "Heiligenfelde II", place: 1, userId: "other" },
    ];

    expect(availableCiclaminoPlaces(choices, "Okel", "current")).toEqual([1, 2, 3, 4, 5]);
  });
});
