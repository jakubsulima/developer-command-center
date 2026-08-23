import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { resolveActionContext } from "./actionContext";

const baseAction = { id: "action-1", version: 1, title: "Krok", detail: "", status: "ready" as const, position: 0, isNext: false, pinnedToToday: false, checklist: [] };

describe("resolver kontekstu Działania", () => {
  it("rozpoznaje Działanie należące do Celu", () => {
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal-1", title: "Cel", outcome: "Wynik", kind: "custom", status: "active", visibility: "active", priority: "normal" }];
    expect(resolveActionContext({ ...baseAction, goalId: "goal-1" }, state)).toEqual({ kind: "goal", label: "Działanie w Celu", name: "Cel", to: "/goals/goal-1" });
  });

  it("rozpoznaje Działanie należące bezpośrednio do Projektu", () => {
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-1", name: "Projekt", description: "", visibility: "active", createdAt: "now", updatedAt: "now" }];
    expect(resolveActionContext({ ...baseAction, areaId: "project-1" }, state)).toEqual({ kind: "project", label: "Działanie w Projekcie", name: "Projekt", to: "/projects/project-1" });
  });

  it("odróżnia Działanie samodzielne od brakującego Projektu", () => {
    const state = structuredClone(emptyState);
    expect(resolveActionContext(baseAction, state)).toMatchObject({ kind: "standalone", label: "Samodzielne Działanie", to: "/" });
    expect(resolveActionContext({ ...baseAction, areaId: "missing" }, state)).toMatchObject({ kind: "missing-project", label: "Projekt niedostępny", name: "Niedostępny Projekt" });
  });
});
