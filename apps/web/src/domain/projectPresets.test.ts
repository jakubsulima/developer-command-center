import { describe, expect, it } from "vitest";
import { categoryPresetSuggestion, normalizeProjectPreset, projectPresets } from "./projectPresets";

describe("Project presets", () => {
  it("uses one common category suggestion and defaults conflicts to Standard", () => {
    const categories = [
      { id: "reading", name: "Czytanie", color: "blue", defaultPreset: "reading" as const },
      { id: "learning", name: "Nauka", color: "violet", defaultPreset: "reading" as const },
      { id: "work", name: "Praca", color: "green", defaultPreset: "standard" as const }
    ];
    expect(categoryPresetSuggestion(categories, ["reading", "learning"])).toEqual({ preset: "reading", conflict: false });
    expect(categoryPresetSuggestion(categories, ["reading", "work"])).toEqual({ preset: "standard", conflict: true });
    expect(categoryPresetSuggestion(categories, [])).toEqual({ preset: "standard", conflict: false });
  });

  it("provides an explicit Reading Library default view and stable legacy fallback", () => {
    expect(projectPresets.reading.defaultView).toBe("knowledge");
    expect(normalizeProjectPreset(undefined)).toBe("standard");
    expect(normalizeProjectPreset("unknown")).toBe("standard");
  });
});
