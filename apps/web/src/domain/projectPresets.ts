import type { ProjectCategory, ProjectPreset } from "./types";

export interface ProjectPresetDefinition {
  id: ProjectPreset;
  label: string;
  description: string;
  defaultView: "overview" | "knowledge";
  sectionOrder: readonly ("overview" | "goals" | "actions" | "knowledge")[];
  mainActionLabel: string;
  emptyState: { title: string; description: string };
}

export const projectPresets: Record<ProjectPreset, ProjectPresetDefinition> = {
  standard: {
    id: "standard",
    label: "Standardowy",
    description: "Grupy działań, Działania i Wiedza we wspólnym kontekście.",
    defaultView: "overview",
    sectionOrder: ["overview", "goals", "actions", "knowledge"],
    mainActionLabel: "Dodaj w Projekcie",
    emptyState: {
      title: "Utwórz pierwszą grupę działań",
      description: "Dodaj kategorię pracy lub zadanie nadrzędne, a pod nim konkretne Działania."
    }
  },
  reading: {
    id: "reading",
    label: "Czytelnia",
    description: "Biblioteka Materiałów z własnym kontekstem czytania.",
    defaultView: "knowledge",
    sectionOrder: ["knowledge", "overview", "goals", "actions"],
    mainActionLabel: "Dodaj książkę",
    emptyState: {
      title: "Czytelnia jest gotowa",
      description: "Zachowaj tu Materiały, po które chcesz sięgnąć."
    }
  }
};

export function normalizeProjectPreset(value: unknown): ProjectPreset {
  return value === "reading" ? "reading" : "standard";
}

export function categoryPresetSuggestion(categories: ProjectCategory[], categoryIds: string[]) {
  const presets = [...new Set(categories
    .filter((category) => categoryIds.includes(category.id) && category.defaultPreset)
    .map((category) => category.defaultPreset!))];
  return {
    preset: presets.length === 1 ? presets[0]! : "standard" as const,
    conflict: presets.length > 1
  };
}
