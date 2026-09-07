import type { KnowledgeKind } from "./types";

export type CreatableKnowledgeKind = Extract<KnowledgeKind, "note" | "resource" | "decision">;

export const creatableKnowledgeKinds = ["note", "resource", "decision"] as const satisfies readonly CreatableKnowledgeKind[];
export const filterableKnowledgeKinds = [...creatableKnowledgeKinds, "artifact"] as const satisfies readonly KnowledgeKind[];

export function isFilterableKnowledgeKind(
  kind: KnowledgeKind,
): kind is (typeof filterableKnowledgeKinds)[number] {
  return filterableKnowledgeKinds.includes(
    kind as (typeof filterableKnowledgeKinds)[number],
  );
}

export const knowledgeKindGuidance: Record<CreatableKnowledgeKind, {
  label: string;
  description: string;
  titleLabel: string;
  titlePlaceholder: string;
  detailLabel: string;
  detailPlaceholder: string;
  detailRequired: boolean;
  saveLabel: string;
}> = {
  note: {
    label: "Notatka",
    description: "Własny zapis, obserwacja lub wniosek.",
    titleLabel: "Tytuł notatki",
    titlePlaceholder: "Np. Wniosek z rozmowy z zespołem",
    detailLabel: "Treść notatki",
    detailPlaceholder: "Zapisz kontekst, obserwacje i to, do czego chcesz wrócić.",
    detailRequired: false,
    saveLabel: "Zapisz notatkę"
  },
  resource: {
    label: "Materiał",
    description: "Zewnętrzne źródło, dokumentacja lub link.",
    titleLabel: "Nazwa materiału",
    titlePlaceholder: "Np. Dokumentacja indeksów PostgreSQL",
    detailLabel: "Dlaczego warto zachować?",
    detailPlaceholder: "Dodaj krótki opis lub najważniejszy fragment.",
    detailRequired: false,
    saveLabel: "Zapisz materiał"
  },
  decision: {
    label: "Decyzja",
    description: "Podjęty wybór wraz z jego uzasadnieniem.",
    titleLabel: "Co zostało zdecydowane?",
    titlePlaceholder: "Np. Używamy PostgreSQL jako głównej bazy",
    detailLabel: "Uzasadnienie i konsekwencje",
    detailPlaceholder: "Dlaczego ta decyzja zapadła i co z niej wynika?",
    detailRequired: true,
    saveLabel: "Zapisz decyzję"
  }
};

export function isCreatableKnowledgeKind(kind: KnowledgeKind): kind is CreatableKnowledgeKind {
  return creatableKnowledgeKinds.includes(kind as CreatableKnowledgeKind);
}
