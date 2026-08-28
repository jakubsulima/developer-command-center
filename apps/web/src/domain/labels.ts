import type { ActionStatus, GoalKind, GoalStatus, InboxStatus, KnowledgeKind, KnowledgeRelationMeaning, ProgressKind } from "./types";

export const goalStatusLabels: Record<GoalStatus, string> = { active: "Aktywny", paused: "Wstrzymany", achieved: "Osiągnięty", abandoned: "Porzucony" };
export const goalKindLabels: Record<GoalKind, string> = { project: "Projekt", learning: "Nauka", personal: "Osobisty", maintenance: "Utrzymanie", custom: "Własny" };
export const knowledgeKindLabels: Record<KnowledgeKind, string> = { note: "Notatka", resource: "Materiał", decision: "Decyzja", artifact: "Rezultat", investigation: "Poszukiwanie" };
export const knowledgeKindIcons: Record<KnowledgeKind, string> = { note: "FileText", resource: "Library", decision: "GitBranch", artifact: "CircleCheck", investigation: "Search" };
export const knowledgeRelationMeaningLabels: Record<KnowledgeRelationMeaning, string> = { material: "Materiał", result: "Rezultat", decision: "Decyzja", reference: "Pozostałe" };
export function knowledgeDefaultRelationMeaning(kind: KnowledgeKind): KnowledgeRelationMeaning {
  if (kind === "artifact") return "result";
  if (kind === "decision") return "decision";
  if (kind === "resource") return "material";
  return "reference";
}
export const inboxStatusLabels: Record<InboxStatus, string> = { unprocessed: "Nowe", snoozed: "Odłożone", resolved: "Przetworzone", discarded: "Odrzucone" };
export const actionStatusLabels: Record<ActionStatus, string> = { ready: "Gotowe", in_progress: "W toku", blocked: "Zablokowane", completed: "Ukończone", skipped: "Pominięte", cancelled: "Anulowane" };
export const progressKindLabels: Record<ProgressKind, string> = { note: "Notatka", decision: "Decyzja", result: "Rezultat", evidence: "Dowód", blocker: "Blokada" };
export const visibilityLabels = { active: "Aktywne", archived: "Archiwum", trashed: "Kosz" } as const;
