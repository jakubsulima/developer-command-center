import { describe, expect, it } from "vitest";
import { normalizeQuickAddContext, parseQuickAddCommand } from "./quickAdd";

describe("quick add commands", () => {
  it.each([
    ["/zadanie Spisać pytania", "action", "Spisać pytania"],
    ["/działanie Odpisać Ani", "action", "Odpisać Ani"],
    ["/cel Uporządkować finanse", "goal", "Uporządkować finanse"],
    ["/wiedza Wzorzec repozytorium", "library", "Wzorzec repozytorium"],
    ["/notatka Pytania do rozmowy", "library", "Pytania do rozmowy"],
    ["/inbox Luźna myśl", "inbox", "Luźna myśl"],
    ["/skrzynka Pomysł do późniejszego triage", "inbox", "Pomysł do późniejszego triage"]
  ] as const)("rozpoznaje %s", (value, mode, content) => {
    expect(parseQuickAddCommand(value)).toEqual({ mode, content });
  });

  it("nie przełącza trybu przed wpisaniem spacji ani dla nieznanej komendy", () => {
    expect(parseQuickAddCommand("/cel")).toBeUndefined();
    expect(parseQuickAddCommand("/nieznana treść")).toBeUndefined();
  });

  it("dziedziczy Projekt z Celu dla Działania i nie pozwala na sprzeczną parę", () => {
    const goals = [{ id: "goal-1", title: "Wynik", areaId: "area-1", visibility: "active" as const, status: "active" as const }];
    const areas = [{ id: "area-1", name: "Projekt", visibility: "active" as const }];
    expect(normalizeQuickAddContext({ mode: "action", goalId: "goal-1", areaId: "other", activeGoals: goals, activeAreas: areas })).toMatchObject({ goalId: "goal-1", areaId: "area-1", goalIds: [] });
  });

  it("przenosi źródłowy Cel do Biblioteki bez duplikatów i oznacza nieaktywny kontekst", () => {
    const goals = [{ id: "goal-1", title: "Wynik", areaId: "area-1", visibility: "active" as const, status: "active" as const }];
    const areas = [{ id: "area-1", name: "Projekt", visibility: "active" as const }];
    expect(normalizeQuickAddContext({ mode: "library", goalId: "goal-1", goalIds: ["goal-1", "goal-1"], activeGoals: goals, activeAreas: areas })).toMatchObject({ areaId: "area-1", goalIds: ["goal-1"] });
    expect(normalizeQuickAddContext({ mode: "action", goalId: "gone", activeGoals: goals, activeAreas: areas }).unavailable).toEqual({ kind: "goal", id: "gone", label: "Nieaktualny Cel" });
  });
  it.each(["action", "goal", "routine", "library"] as const)("nie używa zarchiwizowanego Celu w %s", (mode) => {
    expect(normalizeQuickAddContext({ mode, goalId: "archived", activeGoals: [{ id: "archived", title: "Stary", visibility: "archived", status: "active" }], activeAreas: [] }).unavailable?.kind).toBe("goal");
  });

  it("nie odrzuca po cichu brakującego powiązania Biblioteki", () => {
    expect(normalizeQuickAddContext({ mode: "library", goalIds: ["gone"], activeGoals: [], activeAreas: [] }).unavailable?.id).toBe("gone");
  });

  it("Cel dziedziczy Projekt źródłowego Celu również przy komendzie tekstowej", () => {
    expect(normalizeQuickAddContext({ mode: "goal", goalId: "goal", activeGoals: [{ id: "goal", title: "Wynik", areaId: "area", visibility: "active", status: "active" }], activeAreas: [{ id: "area", name: "Projekt", visibility: "active" }] })).toMatchObject({ areaId: "area", goalIds: [], unavailable: undefined });
  });

});
