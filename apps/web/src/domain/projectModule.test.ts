import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { projectProjection, projectProjections } from "./projectModule";

describe("Project Module", () => {
  it("uses current areas as Project truth and excludes historical Project records", () => {
    const state = {
      ...structuredClone(emptyState),
      areas: [{ id: "current", name: "Bieżący Projekt", description: "Kontekst", visibility: "active" as const, createdAt: "2026-08-01", updatedAt: "2026-08-01" }],
      projects: [{ id: "legacy", name: "Historyczny Projekt", initials: "HP", color: "violet" as const, technology: "Legacy", outcome: "Nie używaj aktywnie", status: "W trakcie" as const, nextStep: "Historia", primary: false, usedMinutes: 0, requirements: [], workItems: [] }]
    };

    expect(projectProjections(state)).toEqual([expect.objectContaining({ id: "current", name: "Bieżący Projekt" })]);
    expect(projectProjection(state, "legacy")).toBeUndefined();
  });

  it("collects direct and derived contents with deterministic ordering", () => {
    const state = {
      ...structuredClone(emptyState),
      areas: [{ id: "project", name: "Projekt", visibility: "active" as const, createdAt: "2026-08-01", updatedAt: "2026-08-01" }],
      goals: [{ id: "goal", title: "Cel", outcome: "Rezultat", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const, areaId: "project" }],
      actions: [{ id: "action", version: 1, title: "Krok", detail: "", goalId: "goal", status: "ready" as const, position: 0, isNext: true, pinnedToToday: false, checklist: [] }],
      knowledge: [
        { id: "late", type: "note" as const, title: "Późniejsza", detail: "", createdAt: "2026-08-02", updatedAt: "2026-08-03" },
        { id: "early", type: "note" as const, title: "Wcześniejsza", detail: "", createdAt: "2026-08-01", updatedAt: "2026-08-02" }
      ],
      knowledgeLinks: [
        { id: "direct", knowledgeItemId: "late", areaId: "project", meaning: "reference" as const, createdAt: "2026-08-01" },
        { id: "derived", knowledgeItemId: "early", actionId: "action", meaning: "material" as const, createdAt: "2026-08-01" }
      ]
    };

    expect(projectProjection(state, "project")?.goals).toHaveLength(1);
    expect(projectProjection(state, "project")?.actions).toHaveLength(1);
    expect(projectProjection(state, "project")?.knowledge.map((item) => item.id)).toEqual(["late", "early"]);
  });
});
