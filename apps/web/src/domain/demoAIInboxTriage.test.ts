import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { createDemoAIInboxTriageProposal } from "./demoAIInboxTriage";

const item = (content: string, kind: "text" | "link" = "text") => ({
  id: `inbox-${content.slice(0, 4)}`,
  kind,
  content,
  createdAt: "2026-08-27T09:00:00.000Z",
  status: "unprocessed" as const
});

describe("demo AI Inbox triage", () => {
  it("rozpoznaje link jako Wiedzę i zachowuje metadane cache", () => {
    const proposal = createDemoAIInboxTriageProposal(structuredClone(emptyState), item("https://example.com/post", "link"), true);
    expect(proposal.cached).toBe(true);
    expect(proposal.proposal).toMatchObject({ decision: "knowledge", knowledgeKind: "resource", linkedType: "none" });
  });

  it("rozpoznaje Działanie i wiąże je z aktywnym Celem", () => {
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal-budget", title: "Budżet domowy", outcome: "Spokojne finanse", kind: "custom", status: "active", visibility: "active", priority: "normal" }];
    const proposal = createDemoAIInboxTriageProposal(state, item("Zrob budzet domowy"));
    expect(proposal.proposal).toMatchObject({ decision: "action", linkedType: "goal", linkedId: "goal-budget" });
  });

  it("rozpoznaje Cel, Projekt i bezpiecznie zatrzymuje niejasne treści", () => {
    const state = structuredClone(emptyState);
    state.projects = [{ id: "project-learn", name: "Nauka TypeScript", initials: "TS", color: "violet", technology: "TypeScript", outcome: "Rozwój", status: "W trakcie", commitmentStatus: "active", nextStep: "Czytać", primary: false, effortBudgetMinutes: 10, usedMinutes: 0, requirements: [], workItems: [] }];
    expect(createDemoAIInboxTriageProposal(state, item("Chce osiagnac bieglosc w TypeScript")).proposal).toMatchObject({ decision: "goal", confidence: "medium", linkedType: "project", linkedId: "project-learn" });
    expect(createDemoAIInboxTriageProposal(state, item("Luźna myśl bez decyzji")).proposal).toMatchObject({ decision: "keep_inbox", confidence: "low" });
    expect(createDemoAIInboxTriageProposal(state, item("krótko")).proposal).toMatchObject({ decision: "keep_inbox", confidence: "low" });
  });
});
