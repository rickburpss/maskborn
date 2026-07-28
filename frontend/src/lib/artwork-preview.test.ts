import { describe, expect, it } from "vitest";
import { genericPreviewLabel, selectLargestPreviewVariant } from "./artwork-preview";

describe("artwork preview selection", () => {
  it("returns no default when a submission has no preview variants", () => {
    expect(selectLargestPreviewVariant([])).toBeUndefined();
    expect(selectLargestPreviewVariant()).toBeUndefined();
  });

  it("selects the preview containing the most trait categories", () => {
    const largest = {
      id: "all",
      label: "All traits",
      categories: ["BACKGROUND", "HATS"],
      url: "/all.svg",
    };
    expect(selectLargestPreviewVariant([
      { id: "hat", label: "Hat", categories: ["HATS"], url: "/hat.svg" },
      largest,
    ])).toBe(largest);
  });

  it("hides submitted accessory names on shared gallery cards", () => {
    expect(genericPreviewLabel(
      { categories: ["HATS"] },
      ["HATS", "EYES"],
    )).toBe("Hats");
    expect(genericPreviewLabel(
      { categories: ["HATS", "EYES"] },
      ["HATS", "EYES"],
    )).toBe("All traits");
  });
});
