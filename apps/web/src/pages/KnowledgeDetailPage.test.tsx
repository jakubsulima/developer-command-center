import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import { KnowledgeDetailPage } from "./KnowledgeDetailPage";

const mocks = vi.hoisted(() => ({ store: vi.fn(), loadItems: vi.fn() }));
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
  mocks.store.mockReturnValue({ mode: "supabase", loading: false, state: {
    ...structuredClone(emptyState), workspaceId: "workspace",
    knowledge: [{ id: "note", type: "note", title: "Wniosek", detail: "Treść" }],
    knowledgeLinks: [{ id: "source", knowledgeItemId: "note", targetKnowledgeItemId: "book-outside-page", meaning: "source", createdAt: "2026-09-26" }]
  } });
});

function renderNote() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/knowledge/note"]}><Routes><Route path="/knowledge/:knowledgeId" element={<KnowledgeDetailPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>);
}

it("pobiera źródłową książkę spoza początkowej strony przy bezpośrednim wejściu", async () => {
  mocks.loadItems.mockResolvedValue([{ id: "book-outside-page", type: "resource", title: "Źródłowa książka", detail: "", resourceFormat: "book" }]);
  renderNote();
  expect(await screen.findByRole("link", { name: "Źródło: Źródłowa książka" })).toHaveAttribute("href", "/knowledge/book-outside-page");
  expect(mocks.loadItems).toHaveBeenCalledWith(["book-outside-page"]);
});

it("po błędzie pozwala ponownie pobrać źródło", async () => {
  mocks.loadItems.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([{ id: "book-outside-page", type: "resource", title: "Źródłowa książka", detail: "" }]);
  renderNote();
  const retry = await screen.findByRole("button", { name: "Spróbuj ponownie" });
  await userEvent.click(retry);
  expect(await screen.findByRole("link", { name: "Źródło: Źródłowa książka" })).toBeInTheDocument();
});
