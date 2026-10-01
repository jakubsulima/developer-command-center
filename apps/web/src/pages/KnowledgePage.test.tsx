import { useState, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import type { AppState, KnowledgeItem } from "../domain/types";
import { KnowledgePage } from "./KnowledgePage";

const mocks = vi.hoisted(() => ({ store: vi.fn(), page: vi.fn() }));
vi.mock("../app/useStore", () => ({ useStore: mocks.store }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: "user" }, mode: "demo" }) }));
vi.mock("../hooks/useWorkspaceInfinitePage", () => ({ useWorkspaceInfinitePage: mocks.page }));
vi.mock("../components/AppShell", () => ({
  AppShell: ({ children, addAction }: { children: ReactNode; addAction: { onClick: () => void } }) => <><button onClick={addAction.onClick}>Dodaj test</button>{children}</>,
  PageHeading: () => null
}));
vi.mock("../components/action-feedback-context", async (original) => ({ ...await original<typeof import("../components/action-feedback-context")>(), useActionFeedback: () => ({ notifyUndo: vi.fn() }) }));

let state: AppState;
let pageItems: KnowledgeItem[];
beforeEach(() => {
  state = { ...structuredClone(emptyState), workspaceId: "workspace" };
  pageItems = [];
  mocks.page.mockImplementation(() => ({ data: { items: pageItems, totalCount: state.knowledge.length }, isPending: false, isError: false, hasNextPage: true }));
});

function Harness() {
  const [current, setCurrent] = useState(state);
  const location = useLocation();
  const navigate = useNavigate();
  mocks.store.mockReturnValue({ state: current, loading: false, createKnowledge: async (input: { title: string; detail: string }) => {
    const item: KnowledgeItem = { id: "new-note", type: "note", title: input.title, detail: input.detail, createdAt: "2026-09-27", version: 1 };
    setCurrent((previous) => ({ ...previous, knowledge: [...previous.knowledge, item] }));
    return item.id;
  }, setVisibility: async (_: string, id: string) => setCurrent((previous) => ({ ...previous, knowledge: previous.knowledge.map((item) => item.id === id ? { ...item, archivedAt: "2026-09-27", version: 2 } : item) })) });
  return <><KnowledgePage /><output data-testid="url">{location.search}</output><button onClick={() => navigate("/knowledge?q=changed")}>Zmień adres</button><button onClick={() => navigate(-1)}>Wstecz test</button><button onClick={() => { pageItems = current.knowledge; setCurrent({ ...current }); }}>Doładuj stronę test</button></>;
}
function start(path: string) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Harness /></MemoryRouter></QueryClientProvider>);
}

it("czyści wyszukiwanie bez przywracania starego q po debounce", async () => {
  const user = userEvent.setup();
  start("/knowledge?q=missing");
  await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
  await waitFor(() => expect(screen.queryByText("Brak pasujących obiektów")).not.toBeInTheDocument());
  expect(screen.getByTestId("url")).toHaveTextContent(/^$/);
  expect(screen.getByRole("searchbox")).toHaveValue("");
});

it("respektuje zmianę URL i historię także podczas oczekującego wyszukiwania", async () => {
  const user = userEvent.setup();
  start("/knowledge?q=original");
  await user.type(screen.getByRole("searchbox"), "x");
  await user.click(screen.getByText("Zmień adres"));
  expect(screen.getByRole("searchbox")).toHaveValue("changed");
  await user.click(screen.getByText("Wstecz test"));
  expect(screen.getByRole("searchbox")).toHaveValue("originalx");
  await waitFor(() => expect(mocks.page).toHaveBeenCalledWith("knowledge", 50, expect.objectContaining({ searchText: "originalx" })));
});

it("pokazuje nową notatkę poza pierwszą stroną, deduplikuje ją i respektuje archiwizację", async () => {
  const user = userEvent.setup();
  state.knowledge = Array.from({ length: 60 }, (_, i) => ({ id: `old-${i}`, type: "note", title: `Stary ${i}`, detail: "", createdAt: "2026-01-01" }));
  pageItems = state.knowledge.slice(0, 50);
  start("/knowledge");
  await user.click(screen.getByText("Dodaj test"));
  await user.type(screen.getByLabelText("Treść notatki"), "Nowa myśl");
  await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
  expect(await screen.findByRole("link", { name: "Nowa myśl" })).toBeInTheDocument();
  await user.click(screen.getByText("Doładuj stronę test"));
  expect(screen.getAllByRole("link", { name: "Nowa myśl" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Więcej opcji: Nowa myśl" }));
  await user.click(screen.getByRole("button", { name: "Archiwizuj" }));
  await waitFor(() => expect(screen.queryByRole("link", { name: "Nowa myśl" })).not.toBeInTheDocument());
});
