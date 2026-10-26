import { useState } from "react";
import { useStore } from "../app/useStore";
import type { KnowledgeItem } from "../domain/types";
import { readingPositionLabel } from "../domain/readingProgress";
import { formatActionDate } from "../domain/actionPresentation";
import { useActionFeedback } from "./action-feedback-context";
import { Button } from "./ui";
export function KnowledgeReadingProgress({ item }: { item: KnowledgeItem }) {
  const { updateKnowledge, state } = useStore();
  const { notifyUndo } = useActionFeedback();
  const [revisitOn, setRevisitOn] = useState(item.revisitOn ?? "");
  const [currentPage, setCurrentPage] = useState(item.currentPage === undefined ? "" : String(item.currentPage));
  const [totalPages, setTotalPages] = useState(item.totalPages === undefined ? "" : String(item.totalPages));
  const [location, setLocation] = useState(item.readingLocation ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!["resource", "note"].includes(item.type) || item.archivedAt || item.trashedAt) return null;
  const isBook = item.resourceFormat === "book";
  return <details className="knowledge-reading-progress"><summary>{isBook ? `Pozycja czytania${readingPositionLabel(item) ? ` · ${readingPositionLabel(item)}` : ""}` : "Data powrotu"}{item.revisitOn ? ` · powrót ${formatActionDate(item.revisitOn, state.workspaceTimezone, { style: "detail" })}` : ""}</summary>
    <form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(""); void (async () => {
      const previous = { revisitOn: item.revisitOn ?? null, ...(isBook ? { currentPage: item.currentPage ?? null, totalPages: item.totalPages ?? null, readingLocation: item.readingLocation ?? null } : {}) };
      try { await updateKnowledge(item.id, { revisitOn: revisitOn || null, ...(isBook ? { currentPage: currentPage === "" ? null : Number(currentPage), totalPages: totalPages === "" ? null : Number(totalPages), readingLocation: location.trim() || null } : {}) }, item.version); notifyUndo({ message: "Zapisano pozycję i datę powrotu.", undo: () => updateKnowledge(item.id, previous, (item.version ?? 1) + 1) }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się zapisać pozycji. Odśwież materiał i spróbuj ponownie."); } finally { setBusy(false); }
    })(); }}><label className="field-label" htmlFor="knowledge-revisit-date">Wróć do materiału</label><input id="knowledge-revisit-date" type="date" value={revisitOn} onChange={(event) => setRevisitOn(event.target.value)} />
    {isBook ? <><label className="field-label" htmlFor="reading-current-page">Bieżąca strona</label><input id="reading-current-page" type="number" min={0} step={1} value={currentPage} onChange={(event) => setCurrentPage(event.target.value)} /><label className="field-label" htmlFor="reading-total-pages">Liczba stron</label><input id="reading-total-pages" type="number" min={1} step={1} value={totalPages} onChange={(event) => setTotalPages(event.target.value)} /><label className="field-label" htmlFor="reading-location">Rozdział lub miejsce</label><input id="reading-location" maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} /><p>Zapis pozycji nie zmienia statusu książki ani Celu. Wniosek dodaj jako Notatkę.</p></> : null}{error ? <p role="alert">{error}</p> : null}<Button type="submit" loading={busy}>Zapisz</Button><Button variant="ghost" disabled={busy} onClick={() => setRevisitOn("")}>Wyczyść datę</Button></form>
  </details>;
}
