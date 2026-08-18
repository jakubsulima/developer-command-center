import { BookMarked, CalendarClock, ChevronDown, Flag, Inbox, ListPlus, Plus, Repeat2, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { parseQuickAddCommand, type QuickAddMode } from "../domain/quickAdd";
import type { KnowledgeKind } from "../domain/types";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useActionFeedback } from "./action-feedback-context";
import { DraftStatus } from "./DraftStatus";
import { Modal } from "./Modal";
import { Button } from "./ui";

const emptyDraft = { mode: "action" as QuickAddMode, content: "", context: "", scheduledFor: "", pinnedToToday: true, knowledgeKind: "note" as KnowledgeKind };

const modes = [
  { id: "action" as const, label: "Działanie", command: "/zadanie", icon: ListPlus },
  { id: "goal" as const, label: "Cel", command: "/cel", icon: Flag },
  { id: "knowledge" as const, label: "Wiedza", command: "/wiedza", icon: BookMarked },
  { id: "inbox" as const, label: "Inbox", command: "/inbox", icon: Inbox }
];

const copy = {
  action: { label: "Co chcesz zrobić?", placeholder: "Np. Spisać trzy pytania do rozmowy\nW kolejnych liniach możesz dodać szczegóły", submit: "Dodaj Działanie", detail: "Konkretny krok, termin i kontekst" },
  goal: { label: "Co chcesz osiągnąć?", placeholder: "Np. Zbudować spokojny budżet domowy\nOpisz rezultat w kolejnych liniach", submit: "Utwórz Cel", detail: "Rezultat, który chcesz doprowadzić do końca" },
  knowledge: { label: "Co chcesz zapamiętać?", placeholder: "Notatka, decyzja, materiał albo rezultat", submit: "Zapisz w Wiedzy", detail: "Notatka, materiał, decyzja lub rezultat" },
  inbox: { label: "Co chcesz zachować?", placeholder: "Myśl, notatka albo link — zdecydujesz później", submit: "Zapisz do Inboxu", detail: "Najszybszy zapis bez porządkowania" }
} satisfies Record<QuickAddMode, { label: string; placeholder: string; submit: string; detail: string }>;

const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };

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
  const navigate = useNavigate();
  const draft = usePersistentDraft("global-quick-add", emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const modeCopy = copy[draft.value.mode];
  const knowledgeKind = draft.value.knowledgeKind ?? "note";
  const scheduledFor = draft.value.scheduledFor ?? "";
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const tomorrowDate = shiftDate(currentDate, 1);
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
    const content = draft.value.content.trim();
    const [firstLine = content, ...rest] = content.split("\n");
    const title = firstLine.trim();
    const detail = rest.join("\n").trim();
    const context = draft.value.context;
    const goalId = context.startsWith("goal:") ? context.slice(5) : undefined;
    const areaId = context.startsWith("area:") ? context.slice(5) : undefined;
    setSaving(true);
    setError("");
    try {
      if (draft.value.mode === "action") {
        await createAction({ title, detail, goalId, areaId, scheduledFor: scheduledFor || undefined, pinnedToToday: draft.value.pinnedToToday });
        notifySuccess(draft.value.pinnedToToday ? "Działanie dodane do Dzisiaj." : "Działanie dodane.");
      } else if (draft.value.mode === "goal") {
        await createGoal({ title, outcome: detail || title, areaId });
        notifySuccess("Cel utworzony.");
      } else if (draft.value.mode === "knowledge") {
        const sourceUrl = knowledgeKind === "resource" && /^https?:\/\//i.test(title) ? title : undefined;
        await createKnowledge(knowledgeKind, title, detail, goalId, sourceUrl);
        notifySuccess("Zapisano w Wiedzy.");
      } else {
        await capture(content);
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
    <Modal open={open} title="Dodaj" className="creation-hub-modal" onClose={() => { setError(""); onClose(); }} closeDisabled={saving}>
      <form className="quick-add" onSubmit={(event) => void submit(event)}>
        <div className="create-hub-intro"><span><Sparkles /></span><div><strong>Jedno miejsce do tworzenia</strong><p>Wybierz typ. Najważniejsze pola zobaczysz od razu, reszta pozostanie pod ręką.</p></div></div>
        <div className="quick-add-modes" role="group" aria-label="Co chcesz dodać?">
          {modes.map(({ id, label, icon: Icon }) => <button type="button" aria-pressed={draft.value.mode === id} key={id} onClick={() => setMode(id)}><span><Icon /></span><small>{label}</small></button>)}
        </div>

        <div className="quick-add-mode-panel" key={draft.value.mode}>
          <div className="quick-add-mode-heading"><span>{modeCopy.label}</span><small>{modeCopy.detail}</small></div>
          <div className="quick-add-composer"><textarea ref={contentRef} id="quick-add-content" aria-label={modeCopy.label} rows={3} autoFocus required placeholder={modeCopy.placeholder} value={draft.value.content} onChange={(event) => updateContent(event.target.value)} onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} /><span><Sparkles /> Pierwsza linia staje się tytułem</span></div>

          {draft.value.mode !== "inbox" ? <details className="quick-add-options">
            <summary><span className="quick-add-options-leading"><span className="quick-add-options-icon"><SlidersHorizontal /></span><span><strong>Powiązania i ustawienia</strong><small>Termin, projekt, rodzaj i dodatkowe opcje</small></span></span><ChevronDown className="quick-add-options-chevron" /></summary>
            <div className="quick-add-options-panel">
              {draft.value.mode === "action" ? <>
              <span className="field-label">Kiedy?</span><div className="quick-add-date-choices" role="group" aria-label="Termin Działania"><button type="button" aria-pressed={scheduledFor === currentDate} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: currentDate, pinnedToToday: true }))}>Dzisiaj</button><button type="button" aria-pressed={scheduledFor === tomorrowDate} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: tomorrowDate, pinnedToToday: false }))}>Jutro</button><button type="button" aria-pressed={!scheduledFor} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: "" }))}>Bez terminu</button></div>
              <label className="field-label" htmlFor="quick-add-date"><CalendarClock /> Dokładna data</label><input id="quick-add-date" type="date" value={scheduledFor} onChange={(event) => draft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} />
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
        </div>

        <div className="quick-add-hint" aria-label="Dostępne komendy">
          <span>Możesz też zacząć od</span>{modes.map(({ id, command }) => <button type="button" key={command} onClick={() => setMode(id)}><kbd>{command}</kbd></button>)}
        </div>
        <button className="quick-add-recurring" type="button" onClick={() => { onClose(); navigate("/?newRecurring=1"); }}><span><Repeat2 /></span><span><strong>Działanie cykliczne</strong><small>Utwórz nawyk, rutynę albo regularne przypomnienie</small></span><Plus /></button>
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        <div className="quick-add-footer">
          <div className="quick-add-draft"><DraftStatus status={draft.status} />{draft.dirty ? <Button type="button" variant="ghost" onClick={draft.discard}>Wyczyść</Button> : null}</div>
          <Button type="submit" variant="primary" loading={saving} disabled={!draft.value.content.trim()}><Plus />{modeCopy.submit}</Button>
        </div>
      </form>
    </Modal>
  );
}
