import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, CircleHelp, Clock3, FileCheck2, FolderPlus, GitBranch, MessageSquareText, Play, Sparkles, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { DraftStatus } from "../components/DraftStatus";
import { RightRail } from "../components/RightRail";
import { Badge, Button, Panel, StatusDot } from "../components/ui";
import { formatDuration, useElapsedTime } from "../hooks/useElapsedTime";
import type { CreatedProjectReference } from "../app/store-context";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useDraftCloseGuard } from "../components/DraftCloseGuard";

const formatter = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" });
const relativeFormatter = new Intl.RelativeTimeFormat("pl", { numeric: "auto" });

function statusTone(status: string) {
  if (status === "Zagrożony") return "danger" as const;
  if (status === "Gotowy do decyzji") return "warning" as const;
  return "success" as const;
}

export function CommandPage() {
  const { state, startFocus } = useStore();
  const navigate = useNavigate();
  const focusProject = state.projects.find((project) => project.id === state.focus.projectId);
  const focusItem = focusProject?.workItems.find((item) => item.id === state.focus.workItemId);
  const elapsed = useElapsedTime(state.focus);
  const pendingInbox = state.inbox.filter((item) => item.status === "unprocessed").length;
  const activeCommitments = state.projects.filter((project) => project.commitmentStatus === "active");

  const openFocus = () => {
    if (!focusProject || !focusItem) return;
    if (!state.focus.running) void startFocus();
    navigate("/focus");
  };

  if (state.projects.length === 0) {
    return (
      <AppShell>
        <PageHeading title="Dzisiaj" eyebrow={formatter.format(new Date())} />
        <FirstFocusOnboarding showEmptyPanel />
      </AppShell>
    );
  }

  if (!focusProject || !focusItem) {
    return (
      <AppShell aside={<RightRail />}>
        <PageHeading title="Dzisiaj" eyebrow={formatter.format(new Date())} />
        <FirstFocusOnboarding showEmptyPanel={false} />
        <Panel className="empty-command">
          <span className="empty-icon"><FolderPlus /></span>
          <h2>Wybierz konkretny krok</h2>
          <p>Project potrzebuje otwartego Work Itemu, zanim rozpoczniesz Focus Session.</p>
          <Button variant="primary" onClick={() => navigate("/projects")}>Przejdź do projektów <ArrowRight /></Button>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell aside={<RightRail />}>
      <PageHeading
        title="Dzisiaj"
        eyebrow={formatter.format(new Date())}
      />
      <FirstFocusOnboarding showEmptyPanel={false} />

      <Panel className="focus-card">
        <div className="focus-topline"><span><StatusDot />Aktualny fokus</span><Badge>WIP</Badge></div>
        <div className="focus-header">
          <div>
            <h2>{focusProject.outcome}</h2>
            <p>Projekt: <Link to={`/projects/${focusProject.id}`}>{focusProject.name}</Link><span className="separator-dot">•</span>{focusProject.technology}</p>
          </div>
          <Button variant="primary" onClick={openFocus}><Play />{state.focus.running ? "Wróć do fokusu" : "Rozpocznij fokus"}</Button>
        </div>
        <div className="focus-details">
          <div>
            <span className="meta-label">Następny krok</span>
            <button className="next-step" onClick={openFocus}>
              <span className="step-check"><Check /></span>
              <span><strong>{focusItem.title}</strong><small>{focusItem.detail}</small></span>
              <ArrowRight />
            </button>
          </div>
          <div className="checkpoint-action">
            <span className="meta-label">Kontekst i ciągłość</span>
            <button onClick={() => navigate("/focus")}><MessageSquareText /><span><strong>{state.focus.running ? formatDuration(elapsed) : "Dodaj krótki komentarz lub decyzję"}</strong><small>Zapisz kontekst przed przerwą.</small></span></button>
          </div>
        </div>
      </Panel>

      <section className="section-block">
        <div className="section-heading"><h2>Aktywne commitments</h2><span><strong>{activeCommitments.length} aktywne</strong> • limit 3</span></div>
        <div className="projects-table">
          <div className="project-table-head"><span>Projekt</span><span>Outcome</span><span>Status</span><span>Następny krok</span><span>Blocker</span><span /></div>
          {activeCommitments.map((project) => (
            <Link className="project-row" to={`/projects/${project.id}`} key={project.id}>
              <span className="project-name"><span className={`project-avatar ${project.color}`}>{project.initials}</span><span><strong>{project.name}</strong><small>{project.technology}</small></span></span>
              <span className="project-outcome">{project.outcome}</span>
              <span className="project-status"><span><StatusDot tone={statusTone(project.status)} />{project.status}</span>{project.primary && <small>Primary</small>}</span>
              <span>{project.nextStep}</span>
              <span className={project.blocker ? `text-${statusTone(project.status)}` : "text-success"}>{project.blocker ?? "Brak"}</span>
              <ArrowRight />
            </Link>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <Panel className="evidence-panel">
          <div className="section-heading"><h2>Dowody postępu</h2><Link to="/learning">Zobacz naukę <ArrowRight /></Link></div>
          <div className="evidence-list">
            {state.evidence.map((item) => (
              <div key={item.id}>
                <span className={`evidence-icon ${item.result}`}>
                  {item.result === "supports" ? (item.title.includes("artefakt") ? <FileCheck2 /> : <CheckCircle2 />) : <CircleHelp />}
                </span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
              </div>
            ))}
          </div>
          {!state.evidence.length && <p className="empty-inline">Dowody pojawią się po ocenionej próbie względem Learning Goal.</p>}
        </Panel>

        <Panel className="checkpoint-panel">
          <div className="section-heading"><h2>Ostatnie checkpointy</h2><Link to="/projects">Wszystkie <ArrowRight /></Link></div>
          <div className="checkpoint-list">
            {state.checkpoints.slice(0, 3).map((checkpoint) => (
              <Link to={`/projects/${checkpoint.projectId}`} key={checkpoint.id}>
                <span className="checkpoint-icon"><GitBranch /></span>
                <span><strong>{checkpoint.title}</strong><small>{checkpoint.currentState}</small><span className="checkpoint-next">Następna akcja: {checkpoint.nextAction}</span></span>
                <time><Clock3 />{relativeFormatter.format(Math.ceil((new Date(checkpoint.createdAt).getTime() - Date.now()) / 86400000), "day")}</time>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Link className="mobile-ai-row" to="/inbox"><Sparkles />AI ma {state.aiProposal === "pending" ? "1 propozycję" : "0 propozycji"}<ArrowRight /></Link>
      <Link className="mobile-inbox-row" to="/inbox"><BookOpenCheck />{pendingInbox} elementów czeka w Inboxie<ArrowRight /></Link>
    </AppShell>
  );
}

type OnboardingStep = "outcome" | "action" | "ready";
const emptyOnboardingDraft: { step: Exclude<OnboardingStep, "ready">; outcome: string; firstAction: string } = { step: "outcome", outcome: "", firstAction: "" };

export function FirstFocusOnboarding({ showEmptyPanel }: { showEmptyPanel: boolean }) {
  const { createProject, startFocus } = useStore();
  const navigate = useNavigate();
  const draft = usePersistentDraft("onboarding", emptyOnboardingDraft);
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<CreatedProjectReference>();
  const [completed, setCompleted] = useState({ outcome: "", firstAction: "" });
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const step: OnboardingStep = created ? "ready" : draft.value.step;
  const { outcome, firstAction } = created ? completed : draft.value;

  const closeGuard = useDraftCloseGuard({ dirty: draft.dirty, status: draft.status, formName: "Kreator pierwszego fokusu", discard: draft.discard, onClose: () => setOpen(false) });
  const close = () => { if (!saving && !starting) closeGuard.requestClose(); };

  const advance = (event: FormEvent) => {
    event.preventDefault();
    if (outcome.trim()) draft.setValue((current) => ({ ...current, step: "action" }));
  };

  const createFirstProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!outcome.trim() || !firstAction.trim()) return;
    setSaving(true);
    setError("");
    try {
      const reference = await createProject({
        title: outcome.trim(),
        outcome: outcome.trim(),
        technology: "",
        firstWorkItemTitle: firstAction.trim(),
        firstWorkItemDescription: ""
      });
      setCompleted({ outcome: outcome.trim(), firstAction: firstAction.trim() });
      setCreated(reference);
      draft.clear();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać pierwszego rezultatu.");
    } finally {
      setSaving(false);
    }
  };

  const beginFocus = async () => {
    if (!created) return;
    setStarting(true);
    setError("");
    const started = await startFocus(created.workItemId);
    if (started) {
      navigate("/focus");
      return;
    }
    setError("Rezultat jest zapisany, ale nie udało się rozpocząć Focus Session. Spróbuj ponownie.");
    setStarting(false);
  };

  return (
    <>
      {showEmptyPanel && (
        <Panel className="empty-command first-focus-empty">
          <span className="empty-icon"><Target /></span>
          <span className="eyebrow">Pierwszy krok w pustym Workspace</span>
          <h2>Zamień rezultat w konkretną sesję pracy</h2>
          <p>Odpowiesz na dwa krótkie pytania. Command utworzy potrzebny Project i przygotuje pierwszy krok do fokusu.</p>
          <Button variant="primary" onClick={() => setOpen(true)}><Play />Rozpocznij pierwszy fokus</Button>
          <small>Bez konfiguracji i planowania całego projektu.</small>
        </Panel>
      )}

      <Modal open={open} title={step === "ready" ? "Wszystko gotowe" : "Przygotuj pierwszy fokus"} onClose={close}>
        {step !== "ready" && (
          <div className="onboarding-progress" aria-label={`Krok ${step === "outcome" ? "1" : "2"} z 2`}>
            <span className="active" />
            <span className={step === "action" ? "active" : ""} />
            <small>Krok {step === "outcome" ? "1" : "2"} z 2</small>
          </div>
        )}

        {step === "outcome" && (
          <form onSubmit={advance} className="onboarding-form">
            <span className="onboarding-kicker">Najpierw kierunek</span>
            <h3>Co ma być prawdą, gdy skończysz?</h3>
            <p>Opisz widoczny rezultat. W modelu Command to <strong>Outcome</strong> — warunek, po którym poznasz, że praca przyniosła efekt.</p>
            <label className="field-label" htmlFor="first-focus-outcome">Rezultat</label>
            <textarea id="first-focus-outcome" rows={4} autoFocus required placeholder="Np. Klienci mogą samodzielnie zresetować hasło" value={outcome} onChange={(event) => draft.setValue((current) => ({ ...current, outcome: event.target.value }))} />
            <div className="draft-row"><DraftStatus status={draft.status} />{draft.dirty && <Button type="button" variant="ghost" onClick={draft.discard}>Odrzuć wersję roboczą</Button>}</div>
            <div className="modal-actions"><Button type="button" onClick={close}>Anuluj</Button><Button type="submit" variant="primary" disabled={!outcome.trim()}>Dalej <ArrowRight /></Button></div>
          </form>
        )}

        {step === "action" && (
          <form onSubmit={(event) => void createFirstProject(event)} className="onboarding-form">
            <span className="onboarding-kicker">Teraz ruch</span>
            <h3>Co konkretnie zrobisz jako pierwsze?</h3>
            <p>Wybierz jedną fizyczną akcję, którą możesz rozpocząć od razu. W Command zapisze się jako pierwszy <strong>Work Item</strong>.</p>
            <div className="outcome-reminder"><span>Twój rezultat</span><strong>{outcome}</strong></div>
            <label className="field-label" htmlFor="first-focus-action">Pierwsza konkretna akcja</label>
            <textarea id="first-focus-action" rows={3} autoFocus required placeholder="Np. Dodać formularz prośby o reset hasła" value={firstAction} onChange={(event) => draft.setValue((current) => ({ ...current, firstAction: event.target.value }))} />
            {error && <p className="auth-message error" role="alert">{error}</p>}
            <div className="draft-row"><DraftStatus status={draft.status} />{draft.dirty && <Button type="button" variant="ghost" onClick={draft.discard}>Odrzuć wersję roboczą</Button>}</div>
            <div className="modal-actions onboarding-actions"><Button type="button" disabled={saving} onClick={() => draft.setValue((current) => ({ ...current, step: "outcome" }))}><ArrowLeft />Wstecz</Button><Button type="submit" variant="primary" loading={saving} disabled={!firstAction.trim()}>Utwórz pierwszy krok <ArrowRight /></Button></div>
          </form>
        )}

        {step === "ready" && (
          <div className="onboarding-ready">
            <span className="ready-icon"><Check /></span>
            <span className="onboarding-kicker">Project, Outcome, Work Item i Commitment zapisane</span>
            <h3>Możesz zacząć bez dalszej konfiguracji</h3>
            <div className="ready-summary"><span>Rezultat</span><strong>{outcome}</strong><span>Pierwsza akcja</span><strong>{firstAction}</strong></div>
            {error && <p className="auth-message error" role="alert">{error}</p>}
            <Button className="start-first-focus" variant="primary" loading={starting} onClick={() => void beginFocus()}><Play />Rozpocznij fokus</Button>
          </div>
        )}
      </Modal>
      {closeGuard.dialog}
    </>
  );
}
