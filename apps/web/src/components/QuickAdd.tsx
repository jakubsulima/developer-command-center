import { BookMarked, ChevronDown, Flag, Inbox, ListPlus, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useStore } from "../app/useStore";
import { parseQuickAddCommand, type QuickAddMode } from "../domain/quickAdd";
import type { KnowledgeKind } from "../domain/types";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useActionFeedback } from "./action-feedback-context";
import { DraftStatus } from "./DraftStatus";
import { Modal } from "./Modal";
import { Button } from "./ui";

const emptyDraft = { mode: "action" as QuickAddMode, content: "", context: "", pinnedToToday: true, knowledgeKind: "note" as KnowledgeKind };

const modes = [
  { id: "action" as const, label: "Działanie", command: "/zadanie", icon: ListPlus },
  { id: "goal" as const, label: "Cel", command: "/cel", icon: Flag },
  { id: "knowledge" as const, label: "Wiedza", command: "/wiedza", icon: BookMarked },
  { id: "inbox" as const, label: "Inbox", command: "/inbox", icon: Inbox }
];

const copy = {
  action: { label: "Co chcesz zrobić?", placeholder: "Np. Spisać trzy pytania do rozmowy", submit: "Dodaj Działanie" },
  goal: { label: "Co chcesz osiągnąć?", placeholder: "Np. Zbudować spokojny budżet domowy", submit: "Utwórz Cel" },
  knowledge: { label: "Co chcesz zapamiętać?", placeholder: "Notatka, decyzja, materiał albo rezultat", submit: "Zapisz w Wiedzy" },
  inbox: { label: "Co chcesz zachować?", placeholder: "Myśl, notatka albo link — zdecydujesz później", submit: "Zapisz do Inboxu" }
} satisfies Record<QuickAddMode, { label: string; placeholder: string; submit: string }>;

const knowledgeKinds: Array<{ value: KnowledgeKind; label: string }> = [
  { value: "note", label: "Notatka" },
  { value: "resource", label: "Materiał" },
  { value: "decision", label: "Decyzja" },
  { value: "artifact", label: "Rezultat" },
  { value: "investigation", label: "Poszukiwanie" }
];

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, createAction, createGoal, createKnowledge, capture } = useStore();
  const { notifySuccess } = useActionFeedback();
  const draft = usePersistentDraft("global-quick-add", emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const modeCopy = copy[draft.value.mode];
  const knowledgeKind = draft.value.knowledgeKind ?? "note";
  const activeGoals = useMemo(() => state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active"), [state.goals]);
  const activeAreas = useMemo(() => state.areas.filter((area) => area.visibility === "active"), [state.areas]);

  const setMode = (mode: QuickAddMode) => {
    setError("");
    draft.setValue((current) => ({ ...current, mode, context: mode === "inbox" ? "" : current.context }));
    window.requestAnimationFrame(() => contentRef.current?.focus());
  };

  const updateContent = (value: string) => {
    const command = parseQuickAddCommand(value);
    setError("");
    draft.setValue((current) => command ? { ...current, mode: command.mode, content: command.content, context: command.mode === "inbox" ? "" : current.context } : { ...current, content: value });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !draft.value.content.trim()) return;
    const title = draft.value.content.trim();
    const context = draft.value.context;
    const goalId = context.startsWith("goal:") ? context.slice(5) : undefined;
    const areaId = context.startsWith("area:") ? context.slice(5) : undefined;
    setSaving(true);
    setError("");
    try {
      if (draft.value.mode === "action") {
        await createAction({ title, goalId, areaId, pinnedToToday: draft.value.pinnedToToday });
        notifySuccess(draft.value.pinnedToToday ? "Działanie dodane do Dzisiaj." : "Działanie dodane.");
      } else if (draft.value.mode === "goal") {
        await createGoal({ title, outcome: title, areaId });
        notifySuccess("Cel utworzony.");
      } else if (draft.value.mode === "knowledge") {
        const [firstLine = title, ...rest] = title.split("\n");
        const detail = rest.join("\n").trim();
        const sourceUrl = knowledgeKind === "resource" && /^https?:\/\//i.test(title) ? title : undefined;
        await createKnowledge(knowledgeKind, firstLine.trim(), detail, goalId, sourceUrl);
        notifySuccess("Zapisano w Wiedzy.");
      } else {
        await capture(title);
        notifySuccess("Zapisano do Inboxu.");
      }
      draft.clear();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Dodaj" onClose={() => { setError(""); onClose(); }} closeDisabled={saving}>
      <form className="quick-add" onSubmit={(event) => void submit(event)}>
        <p className="modal-intro">Wybierz typ, wpisz treść i zapisz. Szczegóły możesz uzupełnić później.</p>
        <div className="quick-add-modes" role="group" aria-label="Co chcesz dodać?">
          {modes.map(({ id, label, icon: Icon }) => <button type="button" aria-pressed={draft.value.mode === id} key={id} onClick={() => setMode(id)}><Icon /><span>{label}</span></button>)}
        </div>

        <label className="field-label" htmlFor="quick-add-content">{modeCopy.label}</label>
        <textarea ref={contentRef} id="quick-add-content" rows={3} autoFocus required placeholder={modeCopy.placeholder} value={draft.value.content} onChange={(event) => updateContent(event.target.value)} onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} />

        {draft.value.mode !== "inbox" ? <details className="quick-add-options">
          <summary><span className="quick-add-options-leading"><span className="quick-add-options-icon"><SlidersHorizontal /></span><span><strong>Powiązania i ustawienia</strong><small>Opcjonalnie — możesz uzupełnić je później</small></span></span><ChevronDown className="quick-add-options-chevron" /></summary>
          <div className="quick-add-options-panel">
            {draft.value.mode === "action" ? <>
              <label className="field-label" htmlFor="quick-add-context">Cel lub Projekt</label>
              <select id="quick-add-context" value={draft.value.context} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>
                <option value="">Bez powiązania</option>
                {activeGoals.length ? <optgroup label="Cele">{activeGoals.map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.title}</option>)}</optgroup> : null}
                {activeAreas.length ? <optgroup label="Projekty">{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup> : null}
              </select>
              <label className="switch-card quick-add-today"><input type="checkbox" checked={draft.value.pinnedToToday} onChange={(event) => draft.setValue((current) => ({ ...current, pinnedToToday: event.target.checked }))} /><span><strong>Pokaż w Dzisiaj</strong><small>Domyślnie nowe Działanie jest od razu pod ręką.</small></span></label>
            </> : null}
            {draft.value.mode === "goal" ? <>
              <label className="field-label" htmlFor="quick-add-project">Projekt</label>
              <select id="quick-add-project" value={draft.value.context.startsWith("area:") ? draft.value.context : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>
                <option value="">Bez Projektu</option>
                {activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}
              </select>
            </> : null}
            {draft.value.mode === "knowledge" ? <>
              <label className="field-label" htmlFor="quick-add-knowledge-kind">Rodzaj Wiedzy</label>
              <select id="quick-add-knowledge-kind" value={knowledgeKind} onChange={(event) => draft.setValue((current) => ({ ...current, knowledgeKind: event.target.value as KnowledgeKind }))}>
                {knowledgeKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </select>
              <label className="field-label" htmlFor="quick-add-knowledge-goal">Powiązany Cel</label>
              <select id="quick-add-knowledge-goal" value={draft.value.context.startsWith("goal:") ? draft.value.context : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>
                <option value="">Bez powiązania</option>
                {activeGoals.map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.title}</option>)}
              </select>
            </> : null}
          </div>
        </details> : null}

        <div className="quick-add-hint" aria-label="Dostępne komendy">
          <span>Możesz też zacząć od</span>{modes.map(({ id, command }) => <button type="button" key={command} onClick={() => setMode(id)}><kbd>{command}</kbd></button>)}
        </div>
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        <div className="quick-add-footer">
          <div className="quick-add-draft"><DraftStatus status={draft.status} />{draft.dirty ? <Button type="button" variant="ghost" onClick={draft.discard}>Wyczyść</Button> : null}</div>
          <Button type="submit" variant="primary" loading={saving} disabled={!draft.value.content.trim()}><Plus />{modeCopy.submit}</Button>
        </div>
      </form>
    </Modal>
  );
}
