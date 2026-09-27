import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import { draftStorageKey } from "../hooks/usePersistentDraft";
import { KnowledgeInbox } from "./InboxPage";

const mocks = vi.hoisted(() => ({ store: vi.fn(), triage: vi.fn(), proposal: vi.fn() }));
vi.mock("../app/useStore", () => ({ useStore: mocks.store }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: "user" }, mode: "demo" }) }));
vi.mock("../hooks/useWorkspaceInfinitePage", () => ({ useWorkspaceInfinitePage: () => ({ data: { items: [] } }), mergePagedItems: (items: unknown[]) => items }));
vi.mock("../components/action-feedback-context", async (original) => ({ ...await original<typeof import("../components/action-feedback-context")>(), useActionFeedback: () => ({ notifyUndo: vi.fn() }) }));

beforeEach(() => {
  mocks.triage.mockReset().mockResolvedValue(undefined);
  mocks.proposal.mockReset().mockResolvedValue({ proposalId: "proposal", proposal: { decision: "knowledge", knowledgeKind: "note", title: "Tytuł AI", detail: "Treść AI", linkedType: "project", linkedId: "project", confidence: "high", reason: "Powód" } });
  mocks.store.mockReturnValue({ loading: false, state: { ...structuredClone(emptyState), workspaceId: "workspace", inbox: [{ id: "capture", content: "Surowa treść", kind: "text", status: "unprocessed", capturedAt: "2026-09-27" }], areas: [{ id: "project", name: "Projekt", visibility: "active" }] }, triageInboxIntent: mocks.triage, releaseDueInbox: vi.fn(), requestInboxTriageProposal: mocks.proposal });
});
async function openProposal() {
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><KnowledgeInbox /></MemoryRouter></QueryClientProvider>);
  await user.click(screen.getByRole("button", { name: /Przetwórz/ }));
  await user.click(screen.getByRole("button", { name: "Zaproponuj przez AI" }));
  await user.click(await screen.findByRole("button", { name: "Edytuj" }));
  return user;
}
it("przenosi treść i Projekt propozycji AI do edytowanej notatki oraz zapisu", async () => {
  const user = await openProposal();
  expect(screen.getByLabelText("Treść notatki")).toHaveValue("Treść AI");
  await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
  expect(mocks.triage).toHaveBeenCalledWith("capture", expect.objectContaining({ title: "Tytuł AI", detail: "Treść AI", projectId: "project" }));
});
it.each([false, true])("chroni istniejący szkic przed nadpisaniem (zamiana: %s)", async (replace) => {
  localStorage.setItem(draftStorageKey("user", "workspace", "inbox-knowledge-note", "capture"), JSON.stringify({ version: 2, value: { title: "Mój tytuł", detail: "Moja treść", goalId: "", projectId: "", idempotencyKey: "draft" } }));
  const user = await openProposal();
  const alert = screen.getByRole("alert");
  await user.click(within(alert).getByRole("button", { name: replace ? "Zastąp szkic propozycją AI" : "Otwórz zapisany szkic" }));
  expect(screen.getByLabelText("Treść notatki")).toHaveValue(replace ? "Treść AI" : "Moja treść");
});
