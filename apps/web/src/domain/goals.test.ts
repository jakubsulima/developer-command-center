import { describe, expect, it } from "vitest";
import { demoState } from "../data/demo";
import { emptyState } from "../data/empty";
import { executeDomainCommand } from "./commands";
import { ensureGoalModel } from "./goals";

describe("ensureGoalModel", () => {
  it("projects legacy projects and learning goals without changing their identifiers", () => {
    const state = ensureGoalModel(demoState);

    expect(state.goals.filter((goal) => goal.legacySource)).toHaveLength(4);
    expect(state.goals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "fintrack-api", title: "FinTrack API", kind: "project" }),
      expect.objectContaining({ id: "goal-ts-modeling", title: "Projektuj skalowalne modele danych", kind: "learning" })
    ]));
    expect(state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "wi-model", goalId: "fintrack-api", title: "Zaprojektuj encje i relacje dla transakcji" })
    ]));
    expect(state.goalCriteria).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "req-1", goalId: "fintrack-api", title: "Transakcja należy do jednego konta" }),
      expect.objectContaining({ goalId: "goal-ts-modeling", title: "Zaprojektuj i obroń model dla realnego systemu" })
    ]));
  });

  it("does not duplicate projected records when hydration runs again", () => {
    const once = ensureGoalModel(demoState);
    const twice = ensureGoalModel(once);

    expect(twice.goals).toHaveLength(once.goals.length);
    expect(twice.actions).toHaveLength(once.actions.length);
    expect(twice.goalCriteria).toHaveLength(once.goalCriteria.length);
  });
});

describe("create_goal", () => {
  it("atomically creates a goal and an optional first action and accepts an idempotent retry", () => {
    const command = {
      type: "create_goal" as const,
      goalId: "goal-1",
      actionId: "action-1",
      title: "Uporządkować domowe finanse",
      outcome: "Mam prosty, aktualny budżet",
      firstActionTitle: "Spisać stałe koszty",
      kind: "personal" as const,
      createdAt: "2026-08-04T12:00:00.000Z"
    };

    const created = executeDomainCommand(emptyState, command);
    const retried = executeDomainCommand(created, command);

    expect(retried.goals).toEqual([expect.objectContaining({ id: "goal-1", status: "active" })]);
    expect(retried.actions).toEqual([expect.objectContaining({ id: "action-1", goalId: "goal-1", isNext: true })]);
  });

  it("rejects an invalid goal without leaving a partial action", () => {
    expect(() => executeDomainCommand(emptyState, {
      type: "create_goal",
      goalId: "goal-1",
      actionId: "action-1",
      title: " ",
      outcome: "Rezultat",
      firstActionTitle: "Pierwszy krok",
      kind: "custom",
      createdAt: "2026-08-04T12:00:00.000Z"
    })).toThrow("goal_title_required");
    expect(emptyState.actions).toHaveLength(0);
  });

  it("creates criteria atomically and edits them without losing completion", () => {
    const created = executeDomainCommand(emptyState, { type: "create_goal", goalId: "goal-criteria", title: "Cel", outcome: "Rezultat", kind: "custom", criteria: [{ id: "criterion-1", title: "Dowód", completed: false }], createdAt: "now" });
    const updated = executeDomainCommand(created, { type: "update_goal", goalId: "goal-criteria", title: "Lepszy Cel", criteria: [{ id: "criterion-1", title: "Dowód", completed: true }], changedAt: "later" });
    expect(updated.goals[0]?.title).toBe("Lepszy Cel");
    expect(updated.goalCriteria).toEqual([expect.objectContaining({ id: "criterion-1", completed: true })]);
  });

  it("requires a reason before abandoning a goal", () => {
    const created = executeDomainCommand(emptyState, { type: "create_goal", goalId: "goal-abandoned", title: "Cel", outcome: "Rezultat", kind: "custom", createdAt: "now" });
    expect(() => executeDomainCommand(created, { type: "set_goal_status", goalId: "goal-abandoned", status: "abandoned", changedAt: "later" })).toThrow("goal_abandon_reason_required");
    expect(executeDomainCommand(created, { type: "set_goal_status", goalId: "goal-abandoned", status: "abandoned", reason: "Zmiana priorytetów", changedAt: "later" }).goals[0]?.status).toBe("abandoned");
  });

  it("records the status decision in the same domain transition", () => {
    const created = executeDomainCommand(emptyState, { type: "create_goal", goalId: "goal-done", title: "Cel", outcome: "Rezultat", kind: "custom", createdAt: "now" });
    const achieved = executeDomainCommand(created, { type: "set_goal_status", goalId: "goal-done", status: "achieved", progressId: "progress-done", progressContent: "Cel osiągnięty.", changedAt: "later" });
    expect(achieved.goals[0]?.status).toBe("achieved");
    expect(achieved.progressEntries[0]).toMatchObject({ id: "progress-done", goalId: "goal-done", content: "Cel osiągnięty." });
  });
});

describe("goal actions", () => {
  it("completes and restores an action without a focus session", () => {
    const state = executeDomainCommand(emptyState, {
      type: "create_goal",
      goalId: "goal-1",
      actionId: "action-1",
      title: "Cel",
      outcome: "Rezultat",
      firstActionTitle: "Krok",
      kind: "custom",
      createdAt: "2026-08-04T12:00:00.000Z"
    });
    const completed = executeDomainCommand(state, {
      type: "set_action_status",
      actionId: "action-1",
      status: "completed",
      changedAt: "2026-08-04T13:00:00.000Z"
    });
    const restored = executeDomainCommand(completed, {
      type: "set_action_status",
      actionId: "action-1",
      status: "ready",
      changedAt: "2026-08-04T13:01:00.000Z"
    });

    expect(completed.actions[0]).toEqual(expect.objectContaining({ status: "completed", completedAt: "2026-08-04T13:00:00.000Z" }));
    expect(completed.focusSessions).toHaveLength(0);
    expect(restored.actions[0]).toEqual(expect.objectContaining({ status: "ready", completedAt: undefined }));
  });

  it("requires a reason for a blocker and preserves it in progress history after unblocking", () => {
    const state = executeDomainCommand(emptyState, {
      type: "create_goal", goalId: "goal-1", actionId: "action-1", title: "Cel", outcome: "Rezultat",
      firstActionTitle: "Krok", kind: "custom", createdAt: "2026-08-04T12:00:00.000Z"
    });
    expect(() => executeDomainCommand(state, {
      type: "set_action_status", actionId: "action-1", status: "blocked", changedAt: "2026-08-04T13:00:00.000Z"
    })).toThrow("action_blocker_required");
    const blocked = executeDomainCommand(state, {
      type: "set_action_status", actionId: "action-1", status: "blocked", blocker: "Czekam na dane", changedAt: "2026-08-04T13:00:00.000Z"
    });
    const restored = executeDomainCommand(blocked, {
      type: "set_action_status", actionId: "action-1", status: "ready", changedAt: "2026-08-04T14:00:00.000Z"
    });
    expect(restored.progressEntries.map((entry) => entry.content).join(" ")).toContain("Czekam na dane");
  });

  it("preserves checklist ids and rejects a stale version", () => {
    const created = executeDomainCommand(emptyState, { type: "create_action", id: "action-1", title: "Krok", createdAt: "now" });
    const withChecklist = executeDomainCommand(created, { type: "update_action", actionId: "action-1", expectedVersion: 1, checklist: [{ id: "check-a", title: "Pierwszy", completed: true }, { id: "check-b", title: "Drugi", completed: false }], changedAt: "later" });
    const renamed = executeDomainCommand(withChecklist, { type: "update_action", actionId: "action-1", expectedVersion: 2, checklist: [{ id: "check-a", title: "Pierwszy poprawiony", completed: true }, { id: "check-b", title: "Drugi", completed: false }], changedAt: "latest" });
    expect(renamed.actions[0]).toMatchObject({ version: 3, checklist: [{ id: "check-a", completed: true }, { id: "check-b", completed: false }] });
    expect(() => executeDomainCommand(renamed, { type: "update_action", actionId: "action-1", expectedVersion: 2, title: "Stary zapis", changedAt: "stale" })).toThrow("action_version_conflict");
  });
});

describe("knowledge editing", () => {
  it("accepts only http/https source URLs on create and update", () => {
    expect(() => executeDomainCommand(emptyState, { type: "create_knowledge", id: "unsafe", kind: "resource", title: "Źródło", detail: "", sourceUrl: "javascript:alert(1)", createdAt: "now" })).toThrow("invalid_knowledge_source_url");
    const created = executeDomainCommand(emptyState, { type: "create_knowledge", id: "safe", kind: "resource", title: "Źródło", detail: "", sourceUrl: " https://example.com/docs ", createdAt: "now" });
    expect(created.knowledge[0]?.sourceUrl).toBe("https://example.com/docs");
    expect(() => executeDomainCommand(created, { type: "update_knowledge", knowledgeId: "safe", sourceUrl: "file:///tmp/a", changedAt: "later" })).toThrow("invalid_knowledge_source_url");
  });

  it("updates content and replaces only goal relations in one transition", () => {
    const state = {
      ...emptyState,
      goals: [
        { id: "goal-a", title: "A", outcome: "A", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const },
        { id: "goal-b", title: "B", outcome: "B", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const }
      ],
      knowledge: [{ id: "knowledge-1", type: "note" as const, title: "Stara", detail: "", createdAt: "now", updatedAt: "now" }],
      knowledgeLinks: [
        { id: "old-goal", knowledgeItemId: "knowledge-1", goalId: "goal-a", meaning: "reference" as const, createdAt: "now" },
        { id: "action-link", knowledgeItemId: "knowledge-1", actionId: "action-1", meaning: "material" as const, createdAt: "now" }
      ]
    };
    const updated = executeDomainCommand(state, {
      type: "update_knowledge", knowledgeId: "knowledge-1", title: "Nowa", kind: "decision",
      goalLinks: [{ id: "new-goal", goalId: "goal-b" }], changedAt: "later"
    });
    expect(updated.knowledge[0]).toMatchObject({ title: "Nowa", type: "decision" });
    expect(updated.knowledgeLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "action-link", actionId: "action-1" }),
      expect.objectContaining({ id: "new-goal", goalId: "goal-b", meaning: "decision" })
    ]));
    expect(updated.knowledgeLinks.some((link) => link.id === "old-goal")).toBe(false);
  });
});

describe("triage_inbox_intent", () => {
  it("atomically turns a capture into an Action and accepts a retry", () => {
    const state = { ...emptyState, inbox: [{ id: "inbox-1", kind: "text" as const, content: "Spisać koszty", createdAt: "2026-08-04T10:00:00.000Z", status: "unprocessed" as const }] };
    const command = { type: "triage_inbox_intent" as const, inboxItemId: "inbox-1", intent: { kind: "action" as const, actionId: "action-1", title: "Spisać koszty", pinnedToToday: true }, decidedAt: "2026-08-04T12:00:00.000Z" };
    const created = executeDomainCommand(state, command);
    const retried = executeDomainCommand(created, command);
    expect(retried.actions).toEqual([expect.objectContaining({ id: "action-1", pinnedToToday: true })]);
    expect(retried.inbox[0]).toEqual(expect.objectContaining({ status: "resolved", resolvedToIds: ["action-1"] }));
  });

  it("keeps the original Inbox provenance on promoted Knowledge", () => {
    const state = { ...emptyState, inbox: [{ id: "inbox-link", kind: "link" as const, content: "https://example.com", createdAt: "2026-08-04T10:00:00.000Z", status: "unprocessed" as const }] };
    const created = executeDomainCommand(state, {
      type: "triage_inbox_intent",
      inboxItemId: "inbox-link",
      intent: { kind: "knowledge", knowledgeId: "knowledge-1", knowledgeKind: "resource", title: "Źródło", detail: "Opis", sourceUrl: "https://example.com" },
      decidedAt: "2026-08-04T12:00:00.000Z"
    });
    expect(created.knowledge[0]).toMatchObject({ id: "knowledge-1", sourceInboxItemId: "inbox-link", sourceUrl: "https://example.com" });
  });
});

describe("editable goal building blocks", () => {
  it("edits user Areas and templates but keeps system templates immutable", () => {
    const state = {
      ...emptyState,
      areas: [{ id: "area-1", name: "Dom", description: "", visibility: "active" as const, createdAt: "now", updatedAt: "now" }],
      goalTemplates: [
        { id: "template-1", name: "Własny", kind: "custom" as const, outcomePrompt: "Co osiągniesz?", defaultActions: [], system: false, visibility: "active" as const },
        { id: "system-1", name: "Projekt", kind: "project" as const, outcomePrompt: "Rezultat", defaultActions: [], system: true, visibility: "active" as const }
      ]
    };
    const area = executeDomainCommand(state, { type: "update_area", areaId: "area-1", name: "Mieszkanie", changedAt: "later" });
    const template = executeDomainCommand(area, { type: "update_goal_template", templateId: "template-1", name: "Plan domu", defaultActions: [{ title: "Spisz zakres" }], changedAt: "later" });
    expect(template.areas[0]?.name).toBe("Mieszkanie");
    expect(template.goalTemplates[0]).toMatchObject({ name: "Plan domu", defaultActions: [{ title: "Spisz zakres" }] });
    expect(() => executeDomainCommand(template, { type: "update_goal_template", templateId: "system-1", name: "Zmieniony", changedAt: "later" })).toThrow("system_template_is_immutable");
  });

  it("updates a recurring series and only eligible future occurrences", () => {
    const state = {
      ...emptyState,
      recurringActionTemplates: [{ id: "series-1", title: "Stara nazwa", detail: "", timezone: "Europe/Warsaw", startsOn: "2026-08-01", rule: { unit: "week" as const, interval: 1 }, missedPolicy: "skip_missed" as const, status: "active" as const, checklist: [], skippedOccurrenceCount: 0, createdAt: "now", updatedAt: "now" }],
      actions: [
        { id: "past", version: 1, title: "Stara nazwa", detail: "", status: "completed" as const, position: 0, isNext: false, pinnedToToday: false, recurringTemplateId: "series-1", occurrenceDate: "2026-08-01", checklist: [] },
        { id: "future", version: 1, title: "Stara nazwa", detail: "", status: "ready" as const, position: 1, isNext: false, pinnedToToday: false, recurringTemplateId: "series-1", occurrenceDate: "2026-08-10", checklist: [] }
      ]
    };
    const updated = executeDomainCommand(state, { type: "update_recurring_template", templateId: "series-1", changes: { title: "Nowa nazwa", checklist: [{ title: "Sprawdź" }] }, updateFutureActions: true, effectiveFrom: "2026-08-04", changedAt: "later" });
    expect(updated.actions.find((item) => item.id === "past")?.title).toBe("Stara nazwa");
    expect(updated.actions.find((item) => item.id === "future")).toMatchObject({ title: "Nowa nazwa", checklist: [{ title: "Sprawdź", completed: false }] });
  });
});
