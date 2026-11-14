import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { executeDomainCommand } from "./commands";
import { migrateLegacyWorkspaceState } from "./goals";
import { activeGoalsWithoutNextAction } from "./weeklyReview";
import { createDemoAIGoalReview } from "./demoAIGoalReview";
import type { AppState, Goal } from "./types";

const at = "2026-11-14T10:00:00Z";
const group: Goal = { id: "ui", title: "UI/UX", outcome: "", kind: "custom", status: "active", visibility: "active", priority: "normal", groupType: "category" };
const stateWith = (value = group): AppState => ({ ...structuredClone(emptyState), goals: [value] });

describe("grupy Działań", () => {
  it("po ukończeniu Działań kategoria pozostaje otwarta na kolejne i nie wymaga rezultatu", () => {
    let state = executeDomainCommand(structuredClone(emptyState), { type: "create_goal", goalId: "ui", title: "UI/UX", outcome: "", kind: "custom", groupType: "category", createdAt: at });
    for (const id of ["one", "two"]) {
      state = executeDomainCommand(state, { type: "create_action", id, title: id, goalId: "ui", createdAt: at });
      state = executeDomainCommand(state, { type: "set_action_status", actionId: id, status: "completed", changedAt: at });
    }
    expect(state.goals[0]).toMatchObject({ id: "ui", status: "active", outcome: "", groupType: "category" });
    state = executeDomainCommand(state, { type: "create_action", id: "third", title: "Kolejna poprawka", goalId: "ui", createdAt: at });
    expect(state.actions.filter((action) => action.goalId === "ui")).toHaveLength(3);
    expect(() => executeDomainCommand(state, { type: "set_goal_status", goalId: "ui", status: "achieved", changedAt: at })).toThrow("category_cannot_be_completed");
  });

  it("zadanie nadrzędne zamyka się osobno i może mieć pusty opcjonalny opis", () => {
    let state = executeDomainCommand(structuredClone(emptyState), { type: "create_goal", goalId: "task", title: "Nowy ekran", outcome: "", kind: "custom", groupType: "task", createdAt: at });
    state = executeDomainCommand(state, { type: "set_goal_status", goalId: "task", status: "achieved", changedAt: at });
    expect(state.goals[0]).toMatchObject({ groupType: "task", status: "achieved" });
  });

  it("stary snapshot zachowuje ID, treść i wszystkie relacje jako zadanie nadrzędne", () => {
    const legacy = { ...group, groupType: undefined, outcome: "Zachowany rezultat" };
    const state = stateWith(legacy);
    state.goalCriteria = [{ id: "criterion", goalId: "ui", title: "Kryterium", completed: true }];
    state.progressEntries = [{ id: "history", goalId: "ui", kind: "result", content: "Dowód", createdAt: at }];
    state.knowledgeLinks = [{ id: "link", knowledgeItemId: "knowledge", goalId: "ui", meaning: "material", createdAt: at }];
    const migrated = migrateLegacyWorkspaceState(state);
    expect(migrated.goals).toEqual([{ ...legacy, groupType: "task" }]);
    for (const field of ["actions", "goalCriteria", "progressEntries", "knowledgeLinks", "recurringActionTemplates"] as const) expect(migrated[field]).toEqual(state[field]);
    expect(migrateLegacyWorkspaceState(migrated)).toEqual(migrated);
  });

  it("jawna konwersja zachowuje opis i relacje, ale chroni kryteria oraz rezultaty", () => {
    const state = stateWith({ ...group, groupType: "task", outcome: "Istniejący opis" });
    state.knowledgeLinks = [{ id: "link", knowledgeItemId: "material", goalId: "ui", meaning: "material", createdAt: at }];
    const change = { type: "update_goal" as const, goalId: "ui", groupType: "category" as const, changedAt: at };
    const changed = executeDomainCommand(state, change);
    expect(changed.goals[0]).toMatchObject({ id: "ui", groupType: "category", outcome: "Istniejący opis" });
    expect(changed.knowledgeLinks).toEqual(state.knowledgeLinks);
    expect(() => executeDomainCommand({ ...state, goalCriteria: [{ id: "criterion", goalId: "ui", title: "Kryterium", completed: false }] }, change)).toThrow(/kryteria/);
    expect(() => executeDomainCommand({ ...state, progressEntries: [{ id: "result", goalId: "ui", kind: "result", content: "Wynik", createdAt: at }] }, change)).toThrow(/historię/);
  });

  it("brak następnego kroku i kryteriów nie oznacza problemu kategorii w przeglądzie", () => {
    const state = stateWith();
    expect(activeGoalsWithoutNextAction(state)).toEqual([]);
    const review = createDemoAIGoalReview(state, new Date(at));
    expect(review.review.goalAssessments[0]).toMatchObject({ goalId: "ui", status: "on_track", signalKeys: [] });
  });
});
