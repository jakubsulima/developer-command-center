import { describe, expect, it } from "vitest";
import type { ReviewRecord, WeeklyReviewSnapshot } from "./types";
import { buildWeeklyReviewMarkdown, weeklyReviewTrendPoints } from "./weeklyReviewTrends";

function review(id: string, startDate: string, timeZone: string, revision = 1, metric = 1, note = ""): ReviewRecord {
  const endDateExclusive = new Date(`${startDate}T12:00:00Z`);
  endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 7);
  const end = endDateExclusive.toISOString().slice(0, 10);
  const snapshot: WeeklyReviewSnapshot = {
    version: 1,
    period: { startDate, endDateExclusive: end, timeZone },
    metrics: { completedActions: metric, knowledgeAdded: 2, progressUpdates: 3 },
    summary: `Migawka ${revision}`,
    note,
    plan: { startDate: end, endDateExclusive: "2026-10-19", selectedGoals: [{ id: "goal", title: "Cel prywatny" }], includeStandalone: false, actions: [{ id: `action-${revision}`, title: `Krok ${revision}`, status: "ready", version: 1, scheduledFor: "2026-10-12" }] }
  };
  return { id, type: "weekly", templateVersion: 2, answers: {}, summary: snapshot.summary, completedAt: `${end}T10:00:00.000Z`, periodStart: startDate, periodEndExclusive: end, workspaceTimezone: timeZone, revision, snapshot };
}

describe("weekly review trends and Markdown export", () => {
  it("uses the latest revision, preserves missing weeks, and separates timezone mismatches", () => {
    const reviews = [
      review("two-old", "2026-09-21", "Europe/Warsaw", 1, 2),
      review("two-latest", "2026-09-21", "Europe/Warsaw", 2, 7),
      review("other-zone", "2026-09-14", "Europe/London", 1, 99),
      review("current", "2026-09-28", "Europe/Warsaw", 1, 4)
    ];
    const points = weeklyReviewTrendPoints(reviews, 4, "Europe/Warsaw", new Date("2026-09-30T12:00:00.000Z"));
    expect(points).toMatchObject([
      { startDate: "2026-09-07", missing: true, differentTimeZone: false, partial: false },
      { startDate: "2026-09-14", missing: true, differentTimeZone: true, timeZone: "Europe/London" },
      { startDate: "2026-09-21", metrics: { completedActions: 7 }, revision: 2, missing: false, partial: false },
      { startDate: "2026-09-28", metrics: { completedActions: 4 }, missing: false, partial: true }
    ]);
  });

  it("exports only the selected snapshot sections and excludes AI text", () => {
    const record = review("export", "2026-09-21", "Europe/Warsaw", 3, 2, "Decyzja prywatna");
    record.snapshot!.summary = "Podsumowanie systemowe";
    const withoutPrivateDecision = buildWeeklyReviewMarkdown(record, { includeDecision: false, includePlan: false });
    expect(withoutPrivateDecision).toContain("Podsumowanie systemowe");
    expect(withoutPrivateDecision).not.toContain("Decyzja prywatna");
    expect(withoutPrivateDecision).not.toContain("Krok 3");
    expect(withoutPrivateDecision).not.toContain("Wynik analizy AI");
    const full = buildWeeklyReviewMarkdown(record, { includeDecision: true, includePlan: true });
    expect(full).toContain("Decyzja prywatna");
    expect(full).toContain("Krok 3 — 2026-10-12 (Gotowe)");
    expect(full).toContain("Treść Przeglądu AI nie jest częścią tego zapisu.");
  });

  it("does not fabricate export data for an older record without a snapshot", () => {
    const old: ReviewRecord = { id: "old", type: "weekly", templateVersion: 1, answers: {}, summary: "Starszy format", completedAt: "2026-08-01T00:00:00Z" };
    expect(() => buildWeeklyReviewMarkdown(old, { includeDecision: true, includePlan: true })).toThrow("weekly_review_snapshot_missing");
  });
});
