import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import { KnowledgeDetailPage } from "./KnowledgeDetailPage";

const mocks = vi.hoisted(() => ({ store: vi.fn(), loadItems: vi.fn(), createKnowledge: vi.fn(), updateKnowledge: vi.fn(), linkKnowledge: vi.fn(), unlinkKnowledge: vi.fn(), setVisibility: vi.fn() }));
vi.mock("../app/useStore", () => ({ useStore: mocks.store }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: "user" }, mode: "supabase" }) }));
vi.mock("../components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("../components/action-feedback-context", async (importOriginal) => ({ ...await importOriginal<typeof import("../components/action-feedback-context")>(), useActionFeedback: () => ({ notifyUndo: vi.fn() }) }));
vi.mock("../data/supabaseWorkspaceRepository", () => ({ createSupabaseWorkspaceRepository: () => ({
  loadKnowledgeItems: mocks.loadItems,
  loadPage: async () => ({ items: [] })
}) }));

beforeEach(() => {
  mocks.loadItems.mockReset();
  mocks.createKnowledge.mockReset().mockResolvedValue(undefined);
  mocks.updateKnowledge.mockReset().mockResolvedValue(undefined);
  mocks.linkKnowledge.mockReset().mockResolvedValue(undefined);
  mocks.unlinkKnowledge.mockReset().mockResolvedValue(undefined);
  mocks.setVisibility.mockReset().mockResolvedValue(undefined);
  mocks.store.mockReturnValue({ mode: "supabase", loading: false, state: {
    ...structuredClone(emptyState), workspaceId: "workspace",
    knowledge: [{ id: "note", type: "note", title: "Wniosek", detail: "Treść" }],
    knowledgeLinks: [{ id: "source", knowledgeItemId: "note", targetKnowledgeItemId: "book-outside-page", meaning: "source", createdAt: "2026-09-26" }]
  }, createKnowledge: mocks.createKnowledge, updateKnowledge: mocks.updateKnowledge, linkKnowledge: mocks.linkKnowledge, unlinkKnowledge: mocks.unlinkKnowledge, setVisibility: mocks.setVisibility });
});

function renderKnowledge(path = "/knowledge/note") {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><Routes><Route path="/knowledge/:knowledgeId" element={<KnowledgeDetailPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>);
}

it("pobiera źródłową książkę spoza początkowej strony przy bezpośrednim wejściu", async () => {
  mocks.loadItems.mockResolvedValue([{ id: "book-outside-page", type: "resource", title: "Źródłowa książka", detail: "", resourceFormat: "book" }]);
  renderKnowledge();
  expect(await screen.findByRole("link", { name: "Źródło: Źródłowa książka" })).toHaveAttribute("href", "/knowledge/book-outside-page");
  expect(mocks.loadItems).toHaveBeenCalledWith(["book-outside-page"]);
});

it("po błędzie pozwala ponownie pobrać źródło", async () => {
  mocks.loadItems.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([{ id: "book-outside-page", type: "resource", title: "Źródłowa książka", detail: "" }]);
  renderKnowledge();
  const retry = await screen.findByRole("button", { name: "Spróbuj ponownie" });
  await userEvent.click(retry);
  expect(await screen.findByRole("link", { name: "Źródło: Źródłowa książka" })).toBeInTheDocument();
});

it("dodaje notatkę do książki z samej treści i zachowuje źródło", async () => {
  const user = userEvent.setup();
  mocks.store.mockReturnValue({ mode: "supabase", loading: false, state: {
    ...structuredClone(emptyState), workspaceId: "workspace",
    knowledge: [{ id: "book-1", version: 3, type: "resource", title: "Książka testowa", detail: "", resourceFormat: "book", readingStatus: "reading" }],
    knowledgeLinks: []
  }, createKnowledge: mocks.createKnowledge, updateKnowledge: mocks.updateKnowledge, linkKnowledge: mocks.linkKnowledge, unlinkKnowledge: mocks.unlinkKnowledge, setVisibility: mocks.setVisibility });
  renderKnowledge("/knowledge/book-1");
  await user.click(await screen.findByRole("button", { name: "Zapisz myśl" }));
  await user.type(screen.getByLabelText("Treść notatki"), "Ważna myśl\nSzczegół");
  await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
  expect(mocks.createKnowledge).toHaveBeenCalledWith(expect.objectContaining({
    kind: "note", title: "Ważna myśl", detail: "Ważna myśl\nSzczegół",
    relations: [expect.objectContaining({ meaning: "source", target: { targetKnowledgeItemId: "book-1" } })],
    idempotencyKey: expect.any(String)
  }));
});
