import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { savedActionFilters, savedActionParams, type SavedActionView } from "../domain/savedActionViews";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { useActionFeedback } from "./action-feedback-context";
export function SavedActionViews() {
  const { state, saveActionView, deleteActionView, reload } = useStore();
  const [params, setParams] = useSearchParams();
  const { notifyUndo } = useActionFeedback();
  const [editing, setEditing] = useState<SavedActionView | "new">();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const views = [...state.savedActionViews ?? []].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się zmienić widoku."); } finally { setBusy(false); }
  };
  const open = (view: SavedActionView | "new") => { setEditing(view); setName(view === "new" ? "" : view.name); setError(""); };
  return <div className="saved-action-views">
    <details className="saved-views-picker"><summary>Moje widoki <span>{views.length}</span></summary><div className="saved-views-popover"><p className="saved-views-hint">Szybki powrót do Twoich filtrów · {views.length}/5</p>
      {views.map((view) => {
        const missing = Boolean(view.filters.projectId && !state.areas.some((area) => area.id === view.filters.projectId && area.visibility === "active") || view.filters.goalId && !state.goals.some((goal) => goal.id === view.filters.goalId && goal.visibility === "active"));
        return <div className="saved-action-view" key={view.id}><Button variant="ghost" onClick={(event) => { setParams(savedActionParams(view.filters)); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{view.name}</Button>{missing ? <small>Nieaktualny filtr — wybierz dostępny Projekt lub Cel i zapisz nowy widok.</small> : null}<Button variant="ghost" disabled={busy} aria-label={`Zmień nazwę widoku ${view.name}`} onClick={() => open(view)}>Zmień nazwę</Button><Button variant="ghost" disabled={busy} aria-label={`Usuń widok ${view.name}`} onClick={() => void run(async () => { await deleteActionView(view.id, view.version); notifyUndo({ message: "Usunięto widok.", undo: () => saveActionView(view, 0) }); })}>Usuń</Button></div>;
      })}
      <Button disabled={busy || views.length >= 5} onClick={() => open("new")}>Zapisz obecny widok</Button>
    </div></details>
    {error ? <p role="alert">{error} <Button variant="ghost" onClick={() => void reload()}>Odśwież listę</Button></p> : null}
    <Modal open={Boolean(editing)} title={editing === "new" ? "Zapisz widok Działań" : "Zmień nazwę widoku"} onClose={() => setEditing(undefined)} closeDisabled={busy}>
      <form onSubmit={(event) => { event.preventDefault(); void run(async () => { const now = new Date().toISOString(); const view = editing === "new" ? { id: crypto.randomUUID(), name, filters: savedActionFilters(params), filterVersion: 1 as const, position: views.length, version: 1, createdAt: now, updatedAt: now } : { ...editing!, name, updatedAt: now }; await saveActionView(view, editing === "new" ? 0 : editing!.version); setEditing(undefined); }); }}><label className="field-label" htmlFor="saved-view-name">Nazwa widoku</label><input id="saved-view-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} /><p>Filtr „Na dziś” zawsze dotyczy bieżącego dnia.</p>{error ? <p role="alert">{error}</p> : null}<Button type="submit" loading={busy}>Zapisz</Button></form>
    </Modal>
  </div>;
}
