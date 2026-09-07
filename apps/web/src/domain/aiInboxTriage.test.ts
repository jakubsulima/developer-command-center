import { describe, expect, it } from "vitest";
import { AIInboxTriageError, decodeAIInboxTriageProposalContent } from "./aiInboxTriage";

const valid = { schemaVersion: 1, decision: "action", confidence: "high", reason: "Treść opisuje krok.", title: "Zrób budżet", detail: "Policz wydatki.", knowledgeKind: null, linkedType: "goal", linkedId: "goal-1", targetDate: "2026-09-01" };

describe("AI Inbox Triage contract", () => {
  it("akceptuje poprawną propozycję i zachowuje termin oraz powiązanie", () => {
    expect(decodeAIInboxTriageProposalContent(valid)).toMatchObject({ decision: "action", linkedId: "goal-1", targetDate: "2026-09-01" });
  });

  it.each([
    { ...valid, extra: true },
    { ...valid, linkedType: "none", linkedId: "foreign" },
    { ...valid, confidence: "low" },
    { ...valid, targetDate: "2026-02-30" },
    { ...valid, decision: "keep_inbox", title: "Nie powinno być zmiany" }
  ])("odrzuca niepoprawną propozycję: %#", (payload) => {
    expect(() => decodeAIInboxTriageProposalContent(payload)).toThrow(AIInboxTriageError);
  });

  it.each(["artifact", "investigation"])("nie proponuje systemowego lub zadaniowego rodzaju Wiedzy: %s", (knowledgeKind) => {
    const payload = { ...valid, decision: "knowledge", title: "Wpis", detail: "Opis", knowledgeKind, linkedType: "none", linkedId: null, targetDate: null };
    expect(() => decodeAIInboxTriageProposalContent(payload)).toThrow(AIInboxTriageError);
  });
});
