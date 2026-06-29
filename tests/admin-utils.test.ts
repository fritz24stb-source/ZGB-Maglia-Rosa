import { describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/admin/csv";
import {
  getFormInteger,
  getOptionalFormNumber,
  parseIntegerList,
  parseTextList,
  requireTextList,
} from "@/lib/admin/forms";

describe("admin form helpers", () => {
  it("normalizes comma, semicolon and line separated text lists", () => {
    expect(parseTextList("fondo, zgb\nscuola; fondo")).toEqual([
      "fondo",
      "zgb",
      "scuola",
    ]);
  });

  it("validates integer lists with bounds", () => {
    expect(parseIntegerList("3, 4", { max: 7, min: 1 })).toEqual([3, 4]);
    expect(() => parseIntegerList("0", { max: 7, min: 1 })).toThrow(
      "Listenwert muss mindestens 1 sein.",
    );
  });

  it("parses form numbers with decimal commas", () => {
    const formData = new FormData();
    formData.set("points", "250");
    formData.set("distance", "123,4");

    expect(getFormInteger(formData, "points", { min: 1 })).toBe(250);
    expect(getOptionalFormNumber(formData, "distance", { min: 0 })).toBe(123.4);
  });

  it("requires non-empty keyword lists", () => {
    expect(() => requireTextList("", "Keywords fehlen.")).toThrow(
      "Keywords fehlen.",
    );
  });
});

describe("admin csv helper", () => {
  it("quotes delimiter, quotes and line breaks", () => {
    expect(
      buildCsv([
        ["Name", "Kommentar"],
        ["ZGB", "A;B"],
        ["Quote", 'A "B"'],
        ["Line", "A\nB"],
      ]),
    ).toBe('Name;Kommentar\r\nZGB;"A;B"\r\nQuote;"A ""B"""\r\nLine;"A\nB"');
  });
});
