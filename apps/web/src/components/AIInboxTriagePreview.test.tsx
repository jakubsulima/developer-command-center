import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import type { AIInboxTriageProposal } from "../domain/aiInboxTriage";
import { AIInboxTriagePreview } from "./AIInboxTriagePreview";

const proposal: AIInboxTriageProposal = {
  proposalId: "proposal-1",
  inboxItemId: "inbox-1",
  status: "ready",
  cached: false,
  generatedAt: "2026-08-27T09:00:00.000Z",
  provider: "demo",
  model: "deterministic",
  proposal: {
    schemaVersion: 1,
    decision: "action",
    confidence: "high",
    reason: "Treść opisuje konkretny krok do wykonania.",
    title: "Sprawdzić budżet",
    detail: "Przejrzeć bieżące koszty.",
    knowledgeKind: null,
    linkedType: "none",
    linkedId: null,
    targetDate: "2026-08-30"
  }
};

describe("AIInboxTriagePreview", () => {
  it("pokazuje propozycję i nie zatwierdza jej przed świadomą akcją", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onEdit = vi.fn();
    const onReject = vi.fn();
    render(<AIInboxTriagePreview proposal={proposal} state={structuredClone(emptyState)} onApprove={onApprove} onEdit={onEdit} onReject={onReject} onFeedback={vi.fn()} />);

    expect(screen.getByText("Działanie")).toBeInTheDocument();
    expect(screen.getByText("Sprawdzić budżet")).toBeInTheDocument();
    expect(onApprove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onApprove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Odrzuć" }));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("przy niskiej pewności pokazuje pozostawienie w Skrzynce", () => {
    const keepProposal = structuredClone(proposal);
    keepProposal.proposal = { ...keepProposal.proposal, decision: "keep_inbox", confidence: "low", reason: "Za mało danych.", title: null, detail: null, targetDate: null };
    render(<AIInboxTriagePreview proposal={keepProposal} state={structuredClone(emptyState)} onApprove={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} onFeedback={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pozostaw w Skrzynce" })).toBeInTheDocument();
  });

  it("pokazuje szczegóły propozycji Wiedzy i opcjonalnego Projektu", () => {
    const knowledgeProposal = structuredClone(proposal);
    knowledgeProposal.proposal = { ...knowledgeProposal.proposal, decision: "knowledge", knowledgeKind: "resource", linkedType: "project", linkedId: "project-1", targetDate: null };
    render(<AIInboxTriagePreview proposal={knowledgeProposal} state={structuredClone(emptyState)} onApprove={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} onFeedback={vi.fn()} />);
    expect(screen.getByText("Wiedza")).toBeInTheDocument();
    expect(screen.getByText("Materiał")).toBeInTheDocument();
  });

  it("pokazuje nazwę dozwolonego powiązania z Celem", () => {
    const linkedProposal = structuredClone(proposal);
    linkedProposal.proposal = { ...linkedProposal.proposal, linkedType: "goal", linkedId: "goal-1" };
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal-1", title: "Budżet", outcome: "Spokój", kind: "custom", status: "active", visibility: "active", priority: "normal" }];
    render(<AIInboxTriagePreview proposal={linkedProposal} state={state} onApprove={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} onFeedback={vi.fn()} />);
    expect(screen.getByText("Cel: Budżet")).toBeInTheDocument();
  });
});
