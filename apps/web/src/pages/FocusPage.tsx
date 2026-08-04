import { useState } from "react";
import { ArrowLeft, Bookmark, CheckSquare2, FileText, GitBranch, Pause, Play, Save, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { DraftStatus } from "../components/DraftStatus";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import type { Checkpoint, FocusEndReason } from "../domain/types";
import { formatDuration, useElapsedTime } from "../hooks/useElapsedTime";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useDraftCloseGuard } from "../components/DraftCloseGuard";

const emptyCheckpointDraft = {
  currentState: "",
  nextAction: "",
  endReason: "paused" as FocusEndReason,
  branch: "",
  file: "",
  sourceUrl: "",
  blocker: "",
  checkpointNote: "",
  learningGoalId: "",
  evidenceTitle: "",
  evidenceFeedback: "",
  evidenceResult: "supports" as "supports" | "reveals_gap" | "inconclusive"
};

export function FocusPage() {
  const { state, startFocus, pauseFocus, updateScratchpad, updateCheckpoint, promoteScratchpad, scratchpadStatus } = useStore();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const checkpointDraft = usePersistentDraft(`checkpoint:${(state.focus.sessionId ?? state.focus.workItemId) || "none"}`, emptyCheckpointDraft);
  const checkpoint = checkpointDraft.value;
  const [checkpointSaving, setCheckpointSaving] = useState(false);
  const [checkpointError, setCheckpointError] = useState("");
  const checkpointCloseGuard = useDraftCloseGuard({ dirty: checkpointDraft.dirty, status: checkpointDraft.status, formName: "Context Checkpoint", discard: checkpointDraft.discard, onClose: () => setModalOpen(false) });
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionTarget, setPromotionTarget] = useState<"note" | "decision" | "inbox">("note");
  const [promotionTitle, setPromotionTitle] = useState("");
  const [promotionContent, setPromotionContent] = useState("");
  const project = state.projects.find((item) => item.id === state.focus.projectId);
  const workItem = project?.workItems.find((item) => item.id === state.focus.workItemId);
  const nextWorkItem = project?.workItems.find((item) => item.id !== state.focus.workItemId && !item.completed);
  const elapsed = useElapsedTime(state.focus);
  const editableCheckpoint = state.checkpoints.find((item) => item.workItemId === state.focus.workItemId && !item.lockedAt);

  if (!project || !workItem) {
    return <AppShell><EmptyState icon={<CheckSquare2 />} title="Brak elementu gotowego do fokusu" detail="Najpierw wybierz konkretny Work Item w aktywnym projekcie." action={<Button onClick={() => navigate("/projects")}>Przejdź do projektów</Button>} /></AppShell>;
  }

  const saveCheckpoint = async () => {
    if (checkpoint.endReason !== "work_item_completed" && (!checkpoint.currentState.trim() || !checkpoint.nextAction.trim())) return;
    setCheckpointSaving(true);
    setCheckpointError("");
    const saved = await pauseFocus({
      reason: checkpoint.endReason,
      currentState: checkpoint.currentState,
      nextAction: checkpoint.nextAction,
      branch: checkpoint.branch,
      file: checkpoint.file,
      sourceUrl: checkpoint.sourceUrl,
      blocker: checkpoint.blocker,
      note: checkpoint.checkpointNote,
      evidence: checkpoint.learningGoalId && checkpoint.evidenceTitle.trim() ? { learningGoalId: checkpoint.learningGoalId, title: checkpoint.evidenceTitle.trim(), result: checkpoint.evidenceResult, feedback: checkpoint.evidenceFeedback.trim() } : undefined
    });
    if (saved) {
      checkpointDraft.clear();
      setModalOpen(false);
    } else {
      setCheckpointError("Nie udało się zapisać checkpointu. Wersja robocza pozostała zachowana.");
    }
    setCheckpointSaving(false);
  };
  const openPromotion = () => {
    setPromotionContent(state.focus.scratchpad);
    setPromotionOpen(true);
  };
  const savePromotion = () => {
    if (!state.focus.sessionId || !promotionTitle.trim() || !promotionContent.trim()) return;
    promoteScratchpad(state.focus.sessionId, promotionTarget, promotionTitle, promotionContent);
    setPromotionOpen(false);
    setPromotionTitle("");
  };

  return (
    <AppShell>
      <div className="focus-page">
        <div className="focus-page-head">
          <button className="icon-button" aria-label="Wróć" onClick={() => navigate(-1)}><ArrowLeft /></button>
          <span>Sesja fokusowa</span>
          <Badge>WIP</Badge>
        </div>
        <div className="focus-outcome"><span>Outcome</span><h1>{project.outcome}</h1><p>Projekt: {project.name} <span className="separator-dot">•</span> {project.technology}</p></div>
        <div className="timer" aria-live="polite">{formatDuration(elapsed)}</div>
        <p className="timer-caption">{project.effortBudgetMinutes ? `Budżet: ${project.effortBudgetMinutes} min • ` : ""}Sesja jest ciągłym przedziałem</p>
        <div className="current-step"><span>Aktualny krok</span><h2>{workItem.title}</h2><p>{workItem.detail}</p></div>
        <div className="context-chips"><span><GitBranch />Kontekst: {project.name}</span><span><FileText />{project.technology}</span></div>
        <div className="focus-actions">
          {workItem.completed ? (
            nextWorkItem ? <Button variant="primary" onClick={() => void startFocus(nextWorkItem.id)}><Play />Rozpocznij kolejny Work Item</Button> : <Badge tone="success">Work Item ukończony</Badge>
          ) : state.focus.running ? (
            <Button onClick={() => setModalOpen(true)}><Pause />Pauza</Button>
          ) : (
            <Button onClick={() => void startFocus()}><Play />Wznów fokus</Button>
          )}
          {!workItem.completed && <Button variant="primary" onClick={() => setModalOpen(true)}><Bookmark />Zapisz checkpoint</Button>}
        </div>
        {workItem.completed && <p className="focus-completed"><CheckSquare2 />Work Item ukończony</p>}
        <label className="scratchpad-label" htmlFor="scratchpad">Session scratchpad <small>pozostaje przy tej sesji</small></label>
        <textarea id="scratchpad" className="scratchpad" rows={6} value={state.focus.scratchpad} onChange={(event) => updateScratchpad(event.target.value)} />
        <DraftStatus status={scratchpadStatus} />
        <div className="scratchpad-actions"><Button variant="ghost" disabled={!state.focus.sessionId || !state.focus.scratchpad.trim()} onClick={openPromotion}><Sparkles />Promuj fragment</Button><small>Powstanie kopia; oryginał pozostanie przy sesji.</small></div>
        {editableCheckpoint && !state.focus.running && <EditableCheckpoint checkpoint={editableCheckpoint} onSave={(currentStateValue, nextActionValue) => updateCheckpoint(editableCheckpoint.id, { currentState: currentStateValue, nextAction: nextActionValue })} />}
        {nextWorkItem && <Panel className="next-work-item">
          <span className="meta-label">Kolejny krok</span>
          <div><CheckSquare2 /><span><strong>{nextWorkItem.title}</strong><small>{nextWorkItem.detail}</small></span></div>
        </Panel>}
      </div>

      <Modal open={modalOpen} title="Zapisz checkpoint i zakończ sesję" onClose={checkpointCloseGuard.requestClose}>
        <p className="modal-intro">Wymagane są tylko aktualny stan i następna fizyczna akcja. Pozostały kontekst jest opcjonalny.</p>
        <label className="field-label" htmlFor="end-reason">Powód zakończenia sesji</label>
        <select id="end-reason" value={checkpoint.endReason} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, endReason: event.target.value as FocusEndReason }))} autoFocus><option value="paused">Pauza</option><option value="work_item_completed">Work Item ukończony</option><option value="stopped">Zatrzymano</option><option value="interrupted">Przerwano technicznie</option></select>
        {checkpoint.endReason !== "work_item_completed" && <>
          <label className="field-label" htmlFor="current-state">Aktualny stan</label>
          <textarea id="current-state" rows={4} placeholder="Gdzie skończyłeś i co działa lub nie działa?" value={checkpoint.currentState} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, currentState: event.target.value }))} />
          <label className="field-label" htmlFor="next-action">Następna fizyczna akcja</label>
          <input id="next-action" placeholder="Np. dodać constraint do tabeli transactions" value={checkpoint.nextAction} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, nextAction: event.target.value }))} />
          <details className="checkpoint-details"><summary>Opcjonalny kontekst techniczny</summary><label className="field-label" htmlFor="checkpoint-branch">Branch</label><input id="checkpoint-branch" value={checkpoint.branch} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, branch: event.target.value }))} /><label className="field-label" htmlFor="checkpoint-file">Plik</label><input id="checkpoint-file" value={checkpoint.file} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, file: event.target.value }))} /><label className="field-label" htmlFor="checkpoint-url">URL</label><input id="checkpoint-url" type="url" value={checkpoint.sourceUrl} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, sourceUrl: event.target.value }))} /><label className="field-label" htmlFor="checkpoint-blocker">Blocker</label><input id="checkpoint-blocker" value={checkpoint.blocker} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, blocker: event.target.value }))} /><label className="field-label" htmlFor="checkpoint-note">Notatka</label><textarea id="checkpoint-note" rows={2} value={checkpoint.checkpointNote} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, checkpointNote: event.target.value }))} /></details>
        </>}
        {state.learningGoals.length > 0 && <div className="optional-evidence">
          <label className="field-label" htmlFor="learning-goal">Learning Evidence <span className="optional-label">opcjonalnie</span></label>
          <select id="learning-goal" value={checkpoint.learningGoalId} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, learningGoalId: event.target.value }))}>
            <option value="">Bez dowodu nauki</option>
            {state.learningGoals.filter((goal) => goal.status === "shaped").map((goal) => <option value={goal.id} key={goal.id}>{goal.title}</option>)}
          </select>
          {checkpoint.learningGoalId && <><label className="field-label" htmlFor="evidence-title">Nazwa ocenionej próby</label><input id="evidence-title" value={checkpoint.evidenceTitle} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, evidenceTitle: event.target.value }))} required={Boolean(checkpoint.learningGoalId)} /><label className="field-label" htmlFor="evidence-result">Wynik</label><select id="evidence-result" value={checkpoint.evidenceResult} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, evidenceResult: event.target.value as typeof checkpoint.evidenceResult }))}><option value="supports">Wspiera kryterium</option><option value="reveals_gap">Ujawnia lukę</option><option value="inconclusive">Niejednoznaczny</option></select><label className="field-label" htmlFor="evidence-feedback">Ocena / feedback</label><textarea id="evidence-feedback" rows={2} value={checkpoint.evidenceFeedback} onChange={(event) => checkpointDraft.setValue((current) => ({ ...current, evidenceFeedback: event.target.value }))} /></>}
        </div>}
        {checkpointError && <p className="auth-message error" role="alert">{checkpointError}</p>}
        <div className="draft-row"><DraftStatus status={checkpointDraft.status} />{checkpointDraft.dirty && <Button variant="ghost" onClick={checkpointDraft.discard}>Odrzuć wersję roboczą</Button>}</div>
        <div className="modal-actions"><Button disabled={checkpointSaving} onClick={checkpointCloseGuard.requestClose}>Anuluj</Button><Button variant="primary" loading={checkpointSaving} disabled={(checkpoint.endReason !== "work_item_completed" && (!checkpoint.currentState.trim() || !checkpoint.nextAction.trim())) || Boolean(checkpoint.learningGoalId && !checkpoint.evidenceTitle.trim())} onClick={() => void saveCheckpoint()}><Save />Zapisz i zakończ</Button></div>
      </Modal>
      {checkpointCloseGuard.dialog}
      <Modal open={promotionOpen} title="Promuj fragment scratchpadu" onClose={() => setPromotionOpen(false)}>
        <p className="modal-intro">Promocja tworzy nowy obiekt i zachowuje niezmienioną treść przy Focus Session.</p>
        <label className="field-label" htmlFor="promotion-target">Obiekt docelowy</label>
        <select id="promotion-target" value={promotionTarget} onChange={(event) => setPromotionTarget(event.target.value as typeof promotionTarget)}><option value="note">Note</option><option value="decision">Decision</option><option value="inbox">Inbox Item</option></select>
        <label className="field-label" htmlFor="promotion-title">Tytuł</label>
        <input id="promotion-title" value={promotionTitle} onChange={(event) => setPromotionTitle(event.target.value)} />
        <label className="field-label" htmlFor="promotion-content">Promowany fragment</label>
        <textarea id="promotion-content" rows={5} value={promotionContent} onChange={(event) => setPromotionContent(event.target.value)} />
        <div className="modal-actions"><Button onClick={() => setPromotionOpen(false)}>Anuluj</Button><Button variant="primary" disabled={!promotionTitle.trim() || !promotionContent.trim()} onClick={savePromotion}>Promuj kopię</Button></div>
      </Modal>
    </AppShell>
  );
}

function EditableCheckpoint({ checkpoint, onSave }: { checkpoint: Checkpoint; onSave: (currentState: string, nextAction: string) => void }) {
  const [currentState, setCurrentState] = useState(checkpoint.currentState);
  const [nextAction, setNextAction] = useState(checkpoint.nextAction);
  return <Panel className="editable-checkpoint"><div className="section-heading"><h2>Checkpoint do korekty</h2><Badge tone="neutral">Edytowalny do wznowienia</Badge></div><label className="field-label" htmlFor="edit-checkpoint-state">Edytuj aktualny stan</label><textarea id="edit-checkpoint-state" rows={3} value={currentState} onChange={(event) => setCurrentState(event.target.value)} /><label className="field-label" htmlFor="edit-checkpoint-next">Edytuj następną akcję</label><input id="edit-checkpoint-next" value={nextAction} onChange={(event) => setNextAction(event.target.value)} /><Button variant="primary" disabled={!currentState.trim() || !nextAction.trim()} onClick={() => onSave(currentState, nextAction)}><Save />Zapisz korektę</Button></Panel>;
}
