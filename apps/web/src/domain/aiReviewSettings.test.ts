import { describe, expect, it } from "vitest";
import { AIReviewSettingsError, decodeAIReviewSettings } from "./aiReviewSettings";

describe("ustawienia Przeglądu AI", () => {
  it("dekoduje ustawienia camelCase i kolumny Workspace", () => {
    expect(decodeAIReviewSettings({ ai_review_window_days: 14, ai_review_cache_hours: 168 })).toEqual({ windowDays: 14, cacheHours: 168 });
    expect(decodeAIReviewSettings({ windowDays: 7, cacheHours: 24 })).toEqual({ windowDays: 7, cacheHours: 24 });
  });

  it("uzupełnia tylko brakujące ustawienia starszej wersji", () => {
    expect(decodeAIReviewSettings({ windowDays: 14 })).toEqual({ windowDays: 14, cacheHours: 72 });
    expect(decodeAIReviewSettings(undefined)).toEqual({ windowDays: 28, cacheHours: 72 });
  });

  it.each([{ windowDays: 8 }, { cacheHours: 48 }, { windowDays: "14" }, { windowDays: null }])("odrzuca nieobsługiwaną wartość %o", (settings) => {
    expect(() => decodeAIReviewSettings(settings)).toThrow(AIReviewSettingsError);
  });
});
