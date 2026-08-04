import { ArrowRight, Brain, CheckCircle2, CircleHelp, FlaskConical, Plus, Save, Target, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { AlertDialog } from "../components/AlertDialog";

const emptyGoalForm = { title: "", criterion: "", skill: "" };

export function LearningPage() {
  const { state, createLearningGoal, setLearningGoalStatus } = useStore();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyGoalForm);
  const [saving, setSaving] = useState(false);
  const [abandonGoalId, setAbandonGoalId] = useState<string>();
  const [abandonReason, setAbandonReason] = useState("");
  const [abandonSaving, setAbandonSaving] = useState(false);
  const [abandonError, setAbandonError] = useState("");
  const supports = state.evidence.filter((item) => item.result === "supports").length;
  const gaps = state.evidence.filter((item) => item.result === "reveals_gap").length;
  const submitGoal = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createLearningGoal(form);
      setForm(emptyGoalForm);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };
  const abandonGoal = async () => {
    if (!abandonGoalId || !abandonReason.trim() || abandonSaving) return;
    setAbandonSaving(true);
    setAbandonError("");
    try {
      await setLearningGoalStatus(abandonGoalId, "abandoned", abandonReason);
      setAbandonGoalId(undefined);
      setAbandonReason("");
    } catch (caught) {
      setAbandonError(caught instanceof Error ? caught.message : "Nie udało się porzucić Learning Goalu.");
    } finally {
      setAbandonSaving(false);
    }
  };

  const goalModal = (
    <Modal open={modalOpen} title="Nowy Learning Goal" onClose={() => setModalOpen(false)}>
      <form onSubmit={submitGoal}>
        <label className="field-label" htmlFor="goal-title">Mierzalny rezultat nauki</label>
        <input id="goal-title" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        <label className="field-label" htmlFor="goal-criterion">Kryterium demonstracji</label>
        <textarea id="goal-criterion" required rows={3} value={form.criterion} onChange={(event) => setForm((current) => ({ ...current, criterion: event.target.value }))} />
        <label className="field-label" htmlFor="goal-skill">Rozwijany Skill</label>
        <input id="goal-skill" required value={form.skill} onChange={(event) => setForm((current) => ({ ...current, skill: event.target.value }))} />
        <div className="modal-actions">
          <Button type="button" onClick={() => setModalOpen(false)}>Anuluj</Button>
          <Button type="submit" variant="primary" loading={saving}><Save />Utwórz cel</Button>
        </div>
      </form>
    </Modal>
  );

  if (!state.evidence.length) {
    const learningGoal = state.learningGoals[0];
    return (
      <AppShell>
        <PageHeading title="Nauka" eyebrow="Postęp oparty na ocenionych próbach" action={<Button variant="primary" onClick={() => setModalOpen(true)}><Plus />Nowy cel nauki</Button>} />
        {learningGoal && (
          <Panel className="learning-hero">
            <div className="learning-title">
              <span className="project-avatar violet">LG</span>
              <span><span className="meta-label">Shaped Learning Goal</span><h2>{learningGoal.title}</h2><p>{learningGoal.criterion} • Skill: {learningGoal.skills.join(", ")}</p></span>
            </div>
          </Panel>
        )}
        <EmptyState icon={<Target />} title="Brak ocenionych prób" detail="Uruchom Focus i zapisz Learning Evidence względem kryterium celu." action={<Button onClick={() => navigate("/projects")}>Wybierz Work Item</Button>} />
        {goalModal}
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageHeading title="Nauka" eyebrow="Postęp oparty na ocenionych próbach" action={<Button variant="primary" onClick={() => setModalOpen(true)}><Plus />Nowy cel nauki</Button>} />
      <Panel className="learning-hero">
        <div className="learning-title"><span className="project-avatar violet">LG</span><span><span className="meta-label">Learning loop</span><h2>Udokumentuj mierzalny postęp</h2><p>Każda próba pozostaje konkretnym, ocenionym dowodem względem kryterium.</p></span></div>
        <div className="learning-stats"><div><strong>{supports}</strong><span>dowody wspierające</span></div><div><strong>{gaps}</strong><span>ujawnione luki</span></div><div><strong>{state.evidence.length}</strong><span>wszystkie próby</span></div></div>
      </Panel>
      <Panel className="learning-goals-panel">
        <div className="section-heading"><h2>Learning Goals</h2><Badge tone="neutral">{state.learningGoals.length} cel(e)</Badge></div>
        {state.learningGoals.map((goal) => {
          const canAchieve = state.evidence.some((item) => item.learningGoalId === goal.id && item.result === "supports" && item.accepted);
          return <div className="learning-goal-row" key={goal.id}><span><strong>{goal.title}</strong><small>{goal.criterion} • Skills: {goal.skills.join(", ")}</small></span><div className="button-row">{goal.status === "achieved" ? <Badge tone="success"><CheckCircle2 />Cel osiągnięty</Badge> : goal.status === "abandoned" ? <Badge tone="neutral">Cel porzucony</Badge> : <><Button variant="primary" disabled={!canAchieve} title={!canAchieve ? "Wymagany zaakceptowany dowód wspierający" : undefined} onClick={() => void setLearningGoalStatus(goal.id, "achieved")}><CheckCircle2 />Oznacz jako osiągnięty</Button><Button variant="ghost" onClick={() => { setAbandonError(""); setAbandonGoalId(goal.id); }}><XCircle />Porzuć</Button></>}</div></div>;
        })}
      </Panel>
      <div className="learning-grid">
        <Panel>
          <div className="section-heading"><h2>Learning evidence</h2><Badge tone="success">{state.evidence.length} ocenione próby</Badge></div>
          <div className="learning-evidence-list">{state.evidence.map((item) => <div key={item.id}><span className={`learning-evidence-icon ${item.result}`}>{item.result === "supports" ? <CheckCircle2 /> : <CircleHelp />}</span><span><strong>{item.title}</strong><small>{item.detail}</small><em>{item.result === "supports" ? "Wspiera kryterium" : "Wymaga kolejnej próby"}</em></span></div>)}</div>
        </Panel>
        <div className="learning-side">
          <Panel><h2><Target />Następna demonstracja</h2><p>Wykonaj kolejną próbę względem kryterium i zapisz konkretny wynik.</p><Button variant="primary" onClick={() => navigate("/focus")}>Rozpocznij próbę <ArrowRight /></Button></Panel>
          <Panel><h2><Brain />Ocena prób</h2><div className="skill-row"><CheckCircle2 /><span><strong>Wspiera kryterium</strong><small>{supports} zaakceptowanych dowodów</small></span></div><div className="skill-row"><FlaskConical /><span><strong>Ujawnia lukę</strong><small>{gaps} sygnałów do kolejnej próby</small></span></div></Panel>
        </div>
      </div>
      {goalModal}
      <AlertDialog open={Boolean(abandonGoalId)} title="Porzucić Learning Goal?" objectName={state.learningGoals.find((goal) => goal.id === abandonGoalId)?.title ?? "Learning Goal"} consequence="Cel zostanie zamknięty bez uznania kryterium demonstracji za osiągnięte." preserved="Wszystkie Learning Evidence, Skills i historia prób pozostaną zachowane." recovery="Historyczne dane pozostaną dostępne; w razie potrzeby można utworzyć nowy Learning Goal." confirmLabel="Porzuć cel" confirmDisabled={!abandonReason.trim()} loading={abandonSaving} error={abandonError} onCancel={() => setAbandonGoalId(undefined)} onConfirm={abandonGoal}><label className="field-label" htmlFor="abandon-reason">Powód porzucenia</label><textarea id="abandon-reason" rows={3} value={abandonReason} onChange={(event) => setAbandonReason(event.target.value)} /></AlertDialog>
    </AppShell>
  );
}
