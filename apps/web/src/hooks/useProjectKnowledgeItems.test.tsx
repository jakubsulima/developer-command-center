import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { demoState } from "../data/demo";
import type { KnowledgeItem } from "../domain/types";
import { useProjectKnowledgeItems } from "./useProjectKnowledgeItems";

const source = vi.hoisted(() => ({ state: {} as typeof demoState, load: vi.fn() }));
vi.mock("../app/useStore", () => ({ useStore: () => ({ mode: "supabase", state: source.state }) }));
vi.mock("../data/supabaseWorkspaceRepository", () => ({ createSupabaseWorkspaceRepository: () => ({ loadKnowledgeItems: source.load }) }));

const oldNote: KnowledgeItem = { id: "old", type: "note", title: "Wcześniej wczytana notatka", detail: "Treść", createdAt: "2026-11-13" };
const newNote: KnowledgeItem = { ...oldNote, id: "new", title: "Nowa notatka", createdAt: "2026-11-14" };
const link = (id: string) => ({ id, knowledgeItemId: id, areaId: "project", meaning: "reference" as const, createdAt: "2026-11-14" });

beforeEach(() => {
  source.load.mockReset();
  source.state = { ...structuredClone(demoState), workspaceId: "workspace", knowledge: [], knowledgeLinks: [link("old")] };
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(({ projectId }) => useProjectKnowledgeItems(projectId), {
    initialProps: { projectId: "project" },
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  });
}

it("zachowuje wcześniej wczytaną Wiedzę podczas odświeżenia po dodaniu i po błędzie", async () => {
  source.load.mockResolvedValueOnce([oldNote]);
  const hook = setup();
  await waitFor(() => expect(hook.result.current.items).toEqual([oldNote]));
  let rejectRead!: (error: Error) => void;
  source.load.mockImplementationOnce(() => new Promise((_, reject) => { rejectRead = reject; }));
  source.state = { ...source.state, knowledge: [newNote], knowledgeLinks: [link("old"), link("new")] };
  hook.rerender({ projectId: "project" });
  await waitFor(() => expect(source.load).toHaveBeenCalledTimes(2));
  expect(hook.result.current.items.map((item) => item.id)).toEqual(["new", "old"]);
  expect(hook.result.current.isPending).toBe(false);
  await act(async () => rejectRead(new Error("offline")));
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.items.map((item) => item.id)).toEqual(["new", "old"]);
});

it("usuwa odłączony wpis od razu i nie przenosi danych do innego Projektu lub Workspace", async () => {
  source.load.mockResolvedValueOnce([oldNote]);
  const hook = setup();
  await waitFor(() => expect(hook.result.current.items).toEqual([oldNote]));
  source.load.mockImplementation(() => new Promise(() => undefined));
  source.state = { ...source.state, knowledgeLinks: [] };
  hook.rerender({ projectId: "project" });
  expect(hook.result.current.items).toEqual([]);
  hook.rerender({ projectId: "other-project" });
  expect(hook.result.current.data).toBeUndefined();
  source.state = { ...source.state, workspaceId: "other-workspace" };
  hook.rerender({ projectId: "project" });
  expect(hook.result.current.data).toBeUndefined();
});
