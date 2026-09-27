import { describe, expect, it } from "vitest";
import { emptyState } from "./empty";
import { createLocalWorkspaceRepository } from "./localWorkspaceRepository";
import type { GoalAction } from "../domain/types";

describe("lokalne repozytorium Workspace", () => {
  it("utrwala wersjonowany stan i wykonuje przez ten sam interfejs komendy domenowe", async () => {
    const repository = createLocalWorkspaceRepository({ indexedDb: undefined, storage: localStorage });
    await repository.save(structuredClone(emptyState));

    await repository.execute({
      type: "create_project",
      id: "local-project",
      title: "Projekt lokalny",
      outcome: "Działa bez połączenia",
      technology: "IndexedDB",
      firstWorkItem: { id: "local-work", title: "Sprawdź zapis", detail: "Odśwież aplikację" }
    });

    const restored = await repository.load();
    expect(restored?.projects[0]).toMatchObject({ id: "local-project", domainStatus: "shaped" });
    expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "{}")).toMatchObject({ version: 6 });
  });

  it("wyszukuje bieżący Projekt i nie przeszukuje historycznego agregatu Project", async () => {
    const repository = createLocalWorkspaceRepository({ indexedDb: undefined, storage: localStorage });
    await repository.save({
      ...structuredClone(emptyState),
      areas: [{ id: "current", name: "Bieżący kontekst", description: "Aktywny", visibility: "active", createdAt: "now", updatedAt: "now" }],
      projects: [{ id: "legacy", name: "Historyczny kontekst", initials: "HK", color: "violet", technology: "Legacy", outcome: "Tylko historia", status: "W trakcie", nextStep: "Historia", primary: false, usedMinutes: 0, requirements: [], workItems: [] }]
    });

    await expect(repository.search("bieżący")).resolves.toEqual([expect.objectContaining({ id: "current", type: "project" })]);
    await expect(repository.search("historyczny")).resolves.toEqual([]);
  });

  it("filtruje i stronicuje całą kolekcję Działań przed utworzeniem strony", async () => {
    const repository = createLocalWorkspaceRepository({ indexedDb: undefined, storage: localStorage });
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project", name: "Projekt", visibility: "active", createdAt: "", updatedAt: "" }];
    state.goals = [{ id: "goal", title: "Cel", outcome: "", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project" }];
    state.actions = Array.from({ length: 65 }, (_, index): GoalAction => ({ id: `action-${String(index).padStart(3, "0")}`, version: 1, goalId: "goal", areaId: "project", title: `Krok ${index}`, detail: "", status: "ready", position: index, isNext: false, pinnedToToday: false, scheduledFor: "2026-09-08", checklist: [] }));
    await repository.save(state);
    const first = await repository.loadPage({ workspaceId: "demo", collection: "actions", pageSize: 30, actionFilter: { view: "today", today: "2026-09-08" }});
    const second = await repository.loadPage({ workspaceId: "demo", collection: "actions", pageSize: 30, actionFilter: { view: "today", today: "2026-09-08" }, cursor: first.nextCursor });
    const third = await repository.loadPage({ workspaceId: "demo", collection: "actions", pageSize: 30, actionFilter: { view: "today", today: "2026-09-08" }, cursor: second.nextCursor });
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    expect(ids).toHaveLength(65);
    expect(new Set(ids).size).toBe(65);
    expect(third.nextCursor).toBeUndefined();
  });

  it("filtruje książki po statusie i autorze przed paginacją", async () => {
    const repository = createLocalWorkspaceRepository({ indexedDb: undefined, storage: localStorage });
    const state = structuredClone(emptyState);
    state.knowledge = [
      { id: "book-1", type: "resource", title: "Książka 1", detail: "Opis", resourceFormat: "book", resourceAuthor: "Ada Autor", readingStatus: "reading", updatedAt: "2026-09-01" },
      { id: "book-2", type: "resource", title: "Książka 2", detail: "Opis", resourceFormat: "book", resourceAuthor: "Ada Autor", readingStatus: "read", updatedAt: "2026-09-02" },
      { id: "book-3", type: "resource", title: "Książka 3", detail: "Opis", resourceFormat: "book", resourceAuthor: "Inny Autor", readingStatus: "reading", updatedAt: "2026-09-03" }
    ];
    await repository.save(state);
    const page = await repository.loadPage({ workspaceId: "demo", collection: "knowledge", pageSize: 1, resourceFormat: "book", readingStatus: "reading", searchText: "Ada Autor" });

    expect(page.items).toMatchObject([{ id: "book-1", readingStatus: "reading" }]);
    expect(page.nextCursor).toBeUndefined();
  });

  it("odczytuje starszy snapshot i zachowuje rozszerzenia Wiedzy podczas migracji", async () => {
    const repository = createLocalWorkspaceRepository({ indexedDb: undefined, storage: localStorage });
    const state = structuredClone(emptyState);
    state.areas = [{ id: "library", name: "Czytelnia", preset: "reading", visibility: "active", createdAt: "now", updatedAt: "now" }];
    state.knowledge = [{ id: "book", type: "resource", title: "Książka", detail: "Opis", resourceFormat: "book", resourceAuthor: "Autor", readingStatus: "reading" }];
    localStorage.setItem("command-center-local-workspace-v2", JSON.stringify({ version: 5, savedAt: "now", state }));

    await expect(repository.load()).resolves.toMatchObject({ areas: [{ id: "library", preset: "reading" }], knowledge: [{ id: "book", resourceFormat: "book", resourceAuthor: "Autor", readingStatus: "reading" }] });
    await repository.save((await repository.load())!);
    expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "{}")).toMatchObject({ version: 6 });
  });

  it("zapisuje ustawienia Przeglądu AI lokalnie i uzupełnia starszy stan wartościami domyślnymi", async () => {
    const repository = createLocalWorkspaceRepository({ indexedDb: undefined, storage: localStorage });
    await repository.save(structuredClone(emptyState));
    await repository.saveAIReviewSettings("demo", { windowDays: 7, cacheHours: 24 });
    await expect(repository.load()).resolves.toMatchObject({ aiReviewSettings: { windowDays: 7, cacheHours: 24 } });
    await expect(repository.loadCore("demo")).resolves.toMatchObject({ aiReviewSettings: { windowDays: 7, cacheHours: 24 } });
    await expect(repository.export()).resolves.toMatchObject({ state: { aiReviewSettings: { windowDays: 7, cacheHours: 24 } } });

    const stored = JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "{}") as { state: Record<string, unknown> };
    delete stored.state.aiReviewSettings;
    localStorage.setItem("command-center-local-workspace-v2", JSON.stringify(stored));
    await expect(repository.load()).resolves.toMatchObject({ aiReviewSettings: { windowDays: 28, cacheHours: 72 } });
  });
});
