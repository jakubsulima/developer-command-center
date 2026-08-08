import type { ActionStatus, GoalKind, GoalStatus, InboxStatus, KnowledgeKind } from "./types";

export const goalStatusLabels: Record<GoalStatus, string> = { active: "Aktywny", paused: "Wstrzymany", achieved: "Osiągnięty", abandoned: "Porzucony" };
export const goalKindLabels: Record<GoalKind, string> = { project: "Projekt", learning: "Nauka", personal: "Osobisty", maintenance: "Utrzymanie", custom: "Własny" };
export const knowledgeKindLabels: Record<KnowledgeKind, string> = { note: "Notatka", resource: "Materiał", decision: "Decyzja", artifact: "Rezultat", investigation: "Poszukiwanie" };
export const inboxStatusLabels: Record<InboxStatus, string> = { unprocessed: "Do przetworzenia", snoozed: "Odłożone", resolved: "Zakończone", discarded: "Odrzucone" };
export const actionStatusLabels: Record<ActionStatus, string> = { ready: "Gotowe", in_progress: "W toku", blocked: "Zablokowane", completed: "Ukończone", skipped: "Pominięte", cancelled: "Anulowane" };
export const visibilityLabels = { active: "Aktywne", archived: "Archiwum", trashed: "Kosz" } as const;
