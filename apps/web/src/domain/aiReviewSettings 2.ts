export type AIReviewWindowDays = 7 | 14 | 28;
export type AIReviewCacheHours = 24 | 72 | 168;

export interface AIReviewSettings {
  windowDays: AIReviewWindowDays;
  cacheHours: AIReviewCacheHours;
}

export const DEFAULT_AI_REVIEW_SETTINGS: AIReviewSettings = {
  windowDays: 28,
  cacheHours: 72
};

export class AIReviewSettingsError extends Error {
  constructor(message = "Nieprawidłowe ustawienia Przeglądu AI.") {
    super(message);
    this.name = "AIReviewSettingsError";
  }
}

/** Missing fields are only accepted for older local snapshots and deployments. */
export function decodeAIReviewSettings(value: unknown): AIReviewSettings {
  if (value === undefined || value === null) return { ...DEFAULT_AI_REVIEW_SETTINGS };
  if (typeof value !== "object" || Array.isArray(value)) throw new AIReviewSettingsError();
  const input = value as Record<string, unknown>;
  const windowDays = Object.hasOwn(input, "windowDays") ? input.windowDays : input.ai_review_window_days;
  const cacheHours = Object.hasOwn(input, "cacheHours") ? input.cacheHours : input.ai_review_cache_hours;
  if (windowDays !== undefined && (typeof windowDays !== "number" || ![7, 14, 28].includes(windowDays))) {
    throw new AIReviewSettingsError("Zakres analizy AI musi wynosić 7, 14 albo 28 dni.");
  }
  if (cacheHours !== undefined && (typeof cacheHours !== "number" || ![24, 72, 168].includes(cacheHours))) {
    throw new AIReviewSettingsError("Czas ponownego użycia musi wynosić 1, 3 albo 7 dni.");
  }
  return {
    windowDays: (windowDays ?? DEFAULT_AI_REVIEW_SETTINGS.windowDays) as AIReviewWindowDays,
    cacheHours: (cacheHours ?? DEFAULT_AI_REVIEW_SETTINGS.cacheHours) as AIReviewCacheHours
  };
}
