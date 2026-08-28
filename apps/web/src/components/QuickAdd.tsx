import { BookMarked, CalendarClock, ChevronDown, Flag, ListPlus, Plus, Repeat2, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { parseQuickAddCommand, type QuickAddMode } from "../domain/quickAdd";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useActionFeedback } from "./action-feedback-context";
import { DraftStatus } from "./DraftStatus";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { finishPerformanceTiming } from "../lib/performanceMetrics";

const emptyDraft = { mode: "action" as QuickAddMode, content: "", context: "", scheduledFor: "", pinnedToToday: true };

const modes = [
  { id: "action" as const, label: "Działanie", command: "/dzialanie", icon: ListPlus },
  { id: "goal" as const, label: "Cel", command: "/cel", icon: Flag },
  { id: "knowledge" as const, label: "Do Skrzynki", command: "/skrzynka", icon: BookMarked }
];

const copy = {
  action: { label: "Co chcesz zrobić?", placeholder: "Np. Spisać trzy pytania do rozmowy\nW kolejnych liniach możesz dodać szczegóły", submit: "Dodaj Działanie", detail: "Konkretny krok, termin i kontekst" },
  goal: { label: "Co chcesz osiągnąć?", placeholder: "Np. Zbudować spokojny budżet domowy\nOpisz rezultat w kolejnych liniach", submit: "Utwórz Cel", detail: "Rezultat, który chcesz doprowadzić do końca" },
  knowledge: { label: "Co chcesz zachować?", placeholder: "Wklej link albo zapisz treść — uporządkujesz później", submit: "Zapisz do Skrzynki", detail: "Zapiszesz teraz, uporządkujesz później" }
} satisfies Record<QuickAddMode, { label: string; placeholder: string; submit: string; detail: string }>;

const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, createAction, createGoal, capture } = useStore();
  const { notifySuccess } = useActionFeedback();
  const navigate = useNavigate();
  const draft = usePersistentDraft("global-quick-add", emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const modeCopy = copy[draft.value.mode];
  const scheduledFor = draft.value.scheduledFor ?? "";
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const tomorrowDate = shiftDate(currentDate, 1);
  const activeGoals = useMemo(() => state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active"), [state.goals]);
  const activeAreas = useMemo(() => state.areas.filter((area) => area.visibility === "active"), [state.areas]);

  const setMode = (mode: QuickAddMode) => {
    setError("");
    draft.setValue((current) => ({ ...current, mode, context: mode === "knowledge" ? "" : current.context }));
    window.requestAnimationFrame(() => contentRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      contentRef.current?.focus();
      finishPerformanceTiming("quick-add", "quick-add-open");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draft.value.mode, open]);

  const close = () => {
    setError("");
    onClose();
  };

  const updateContent = (value: string) => {
    const command = parseQuickAddCommand(value);
    setError("");
    draft.setValue((current) => command ? { ...current, mode: command.mode, content: command.content, context: command.mode === "knowledge" ? "" : current.context } : { ...current, content: value });
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
        notifySuccess(draft.value.pinnedToToday ? "Działanie dodane do Startu." : "Działanie dodane.");
      } else if (draft.value.mode === "goal") {
        await createGoal({ title, outcome: detail || title, areaId });
        notifySuccess("Cel utworzony.");
      } else {
        await capture(content);
        notifySuccess("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
      }
      draft.clear();
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Dodaj" className="creation-hub-modal" backdropClassName="quick-add-backdrop" onClose={close} closeDisabled={saving}>
      <form className="quick-add" onSubmit={(event) => void submit(event)}>
        <div className="create-hub-intro"><span><Sparkles /></span><div><strong>Jedno miejsce do tworzenia</strong><p>Działanie jest domyślne. Typ możesz zmienić nad polem, a reszta pozostaje pod ręką.</p></div></div>
        <div className="quick-add-choice-heading"><strong>Co chcesz dodać?</strong><small>Wybierz typ, a pokażę odpowiednie pola.</small></div>
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
          }} /><span><Sparkles />{draft.value.mode === "knowledge" ? " Link rozpoznam automatycznie" : " Pierwsza linia staje się tytułem"}</span></div>

          {draft.value.mode !== "knowledge" ? <details className="quick-add-options">
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
              <label className="switch-card quick-add-today"><input type="checkbox" checked={draft.value.pinnedToToday} onChange={(event) => draft.setValue((current) => ({ ...current, pinnedToToday: event.target.checked }))} /><span><strong>Pokaż na Starcie</strong><small>Domyślnie nowe Działanie jest od razu pod ręką.</small></span></label>
              </> : null}
              {draft.value.mode === "goal" ? <>
              <label className="field-label" htmlFor="quick-add-project">Projekt</label>
              <select id="quick-add-project" value={draft.value.context.startsWith("area:") ? draft.value.context : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>
                <option value="">Bez Projektu</option>
                {activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}
              </select>
              </> : null}
            </div>
          </details> : null}
        </div>

        <div className="quick-add-hint" aria-label="Dostępne komendy">
          <span>Możesz też zacząć od</span>{modes.map(({ id, command }) => <button type="button" key={command} onClick={() => setMode(id)}><kbd>{command}</kbd></button>)}
        </div>
        <button className="quick-add-recurring" type="button" onClick={() => { close(); navigate("/routines?newRecurring=1"); }}><span><Repeat2 /></span><span><strong>Działanie cykliczne</strong><small>Utwórz nawyk, rutynę albo regularne przypomnienie</small></span><Plus /></button>
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        <div className="quick-add-footer">
          <div className="quick-add-draft"><DraftStatus status={draft.status} />{draft.dirty ? <Button type="button" variant="ghost" onClick={draft.discard}>Wyczyść</Button> : null}</div>
          <Button type="submit" variant="primary" loading={saving} disabled={!draft.value.content.trim()}><Plus />{modeCopy.submit}</Button>
        </div>
      </form>
    </Modal>
  );
}
