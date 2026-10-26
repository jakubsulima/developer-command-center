import type { KnowledgeItem } from "./types";
export interface ReadingChanges { revisitOn?: string | null; currentPage?: number | null; totalPages?: number | null; readingLocation?: string | null }
export function applyReadingChanges(item: KnowledgeItem, changes: ReadingChanges): KnowledgeItem {
  const next = { ...item };
  if (changes.revisitOn && (item.type !== "resource" && item.type !== "note" || item.archivedAt || item.trashedAt)) throw new Error("Termin powrotu wymaga aktywnego Materiału lub Notatki.");
  for (const key of ["revisitOn", "currentPage", "totalPages", "readingLocation"] as const) {
    if (changes[key] !== undefined) Object.assign(next, { [key]: changes[key] === null ? undefined : changes[key] });
  }
  if (next.type !== "resource" && next.type !== "note") next.revisitOn = undefined;
  if (next.revisitOn && (!/^\d{4}-\d{2}-\d{2}$/.test(next.revisitOn) || !Number.isFinite(Date.parse(next.revisitOn)) || new Date(`${next.revisitOn}T00:00:00Z`).toISOString().slice(0, 10) !== next.revisitOn)) throw new Error("Nieprawidłowa data powrotu.");
  if ([changes.currentPage, changes.totalPages, changes.readingLocation].some((value) => value !== undefined && value !== null) && next.resourceFormat !== "book") throw new Error("Postęp czytania wymaga książki.");
  if (next.currentPage !== undefined && (!Number.isSafeInteger(next.currentPage) || next.currentPage < 0) || next.totalPages !== undefined && (!Number.isSafeInteger(next.totalPages) || next.totalPages <= 0) || next.currentPage !== undefined && next.totalPages !== undefined && next.currentPage > next.totalPages) throw new Error("Sprawdź bieżącą stronę i liczbę stron książki.");
  if ((next.readingLocation?.length ?? 0) > 200) throw new Error("Opis pozycji może mieć maksymalnie 200 znaków.");
  return next;
}
export function readingPositionLabel(item: KnowledgeItem) {
  const page = item.currentPage === undefined ? undefined : `str. ${item.currentPage}${item.totalPages ? ` / ${item.totalPages} (${Math.round(item.currentPage / item.totalPages * 100)}%)` : ""}`;
  return [page, item.readingLocation].filter(Boolean).join(" · ");
}
