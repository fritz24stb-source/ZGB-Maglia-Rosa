import { describe, expect, it } from "vitest";
import {
  berlinLocalDateTimeToIso,
  defaultCombativeVotingWindow,
  isoToBerlinLocalDateTime,
} from "@/lib/date-time";

describe("Berlin date-time helpers", () => {
  it("converts summer local time to UTC", () => {
    expect(berlinLocalDateTimeToIso("2026-08-05T18:00")).toBe(
      "2026-08-05T16:00:00.000Z",
    );
  });

  it("round-trips winter local time", () => {
    expect(
      isoToBerlinLocalDateTime(berlinLocalDateTimeToIso("2026-12-02T18:00")),
    ).toBe("2026-12-02T18:00");
  });

  it("provides the Wednesday-to-Friday default window", () => {
    expect(defaultCombativeVotingWindow("2026-08-05")).toEqual({
      opensAt: "2026-08-05T18:00",
      closesAt: "2026-08-07T18:00",
    });
  });
});
