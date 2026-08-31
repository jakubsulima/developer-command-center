import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { resolveKnowledgeProjectContexts, resolveKnowledgeRelations, validateKnowledgeTarget } from "./knowledge";

describe("Knowledge Module", () => {
  it("validates exact targets, self-links, duplicates, and target existence", () => {
    const state = {
      ...structuredClone(emptyState),
      areas: [{ id: "project", name: "Projekt", visibility: "active" as const, createdAt: "now", updatedAt: "now" }],
      knowledge: [{ id: "note", type: "note" as const, title: "Notatka", detail: "" }]
    };
    expect(validateKnowledgeTarget(state, "note", "note", { kind: "project", id: "project" }, "reference")).toBe(true);
    expect(() => validateKnowledgeTarget(state, "note", "note", { kind: "knowledge", id: "note" }, "reference")).toThrow("knowledge_self_link_not_allowed");
    expect(() => validateKnowledgeTarget(state, "note", "note", { kind: "goal", id: "missing" }, "reference")).toThrow("goal_not_found");
  });

  it("resolves incoming and outgoing links and derives Project contexts without recursive knowledge propagation", () => {
    const state = {
      ...structuredClone(emptyState),
      areas: [{ id: "project", name: "Projekt", visibility: "active" as const, createdAt: "now", updatedAt: "now" }],
      goals: [{ id: "goal", title: "Cel", outcome: "", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const, areaId: "project" }],
      knowledge: [{ id: "note", type: "note" as const, title: "Notatka", detail: "" }, { id: "source", type: "resource" as const, title: "Źródło", detail: "" }],
      knowledgeLinks: [
        { id: "goal-link", knowledgeItemId: "note", goalId: "goal", meaning: "reference" as const, createdAt: "2026-08-02" },
        { id: "incoming", knowledgeItemId: "source", targetKnowledgeItemId: "note", meaning: "material" as const, createdAt: "2026-08-01" }
      ]
    };
    expect(resolveKnowledgeRelations(state, "note").incoming.map((relation) => relation.label)).toEqual(["Źródło"]);
    expect(resolveKnowledgeProjectContexts(state, "note")).toEqual([{ projectId: "project", source: "goal", sourceId: "goal" }]);
  });
});
