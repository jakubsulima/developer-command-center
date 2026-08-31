import { describe, expect, it } from "vitest";
import { emptyState } from "./empty";
import { createLocalWorkspaceRepository } from "./localWorkspaceRepository";

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
    expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2") ?? "{}")).toMatchObject({ version: 4 });
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
});
