import "./ActionStatusControls.css";
import "./action-form-dialog.css";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Beaker, ChevronDown, Circle, CircleCheck, CircleX, LoaderCircle, OctagonAlert, Repeat2, SkipForward, type LucideIcon } from "lucide-react";
import { actionStatusLabels } from "../domain/labels";
import { describeActionOccurrence } from "../domain/actionPresentation";
import type { ActionStatus, GoalAction } from "../domain/types";
import { Modal } from "./Modal";
import { Button } from "./ui";

export type ProjectActionStatus = ActionStatus;
export type ActionStatusTarget = { action: GoalAction; menu?: boolean };

const standardStatusOptions: ProjectActionStatus[] = ["ready", "in_progress", "testing", "blocked", "completed", "cancelled"];
const statusIcons = {
  ready: Circle,
  in_progress: LoaderCircle,
  testing: Beaker,
  blocked: OctagonAlert,
  completed: CircleCheck,
  skipped: SkipForward,
  cancelled: CircleX
} satisfies Record<ActionStatus, LucideIcon>;
const statusHints: Record<ProjectActionStatus, string> = {
  ready: "Można rozpocząć",
  in_progress: "Praca trwa",
  testing: "Rezultat jest sprawdzany",
  blocked: "Wymaga usunięcia przeszkody",
  completed: "Działanie wykonane",
  skipped: "Tylko to wystąpienie Rutyny",
  cancelled: "Nie będzie realizowane"
};

export function ActionOriginMarker({ action, verbose = false, routineTitle }: { action: GoalAction; verbose?: boolean; routineTitle?: string }) {
  if (!action.recurringTemplateId) return null;
  return <span className="action-origin-marker" title="To Działanie zostało utworzone przez Rutynę"><Repeat2 aria-hidden="true" />{routineTitle ?? (verbose ? "Wystąpienie Rutyny" : "Z Rutyny")}</span>;
}

export function ActionStatusTrigger({ action, disabled = false, density = "list", onClick }: { action: GoalAction; disabled?: boolean; density?: "compact" | "list" | "detail"; onClick: () => void }) {
  const Icon = statusIcons[action.status];
  return <button type="button" className={`action-status-trigger action-status-${density} ${action.status}`} disabled={disabled} aria-label={`Zmień status: ${actionStatusLabels[action.status]} — ${action.title}`} onClick={onClick}>
    <Icon className="action-status-glyph" aria-hidden="true" />
    <span>{actionStatusLabels[action.status]}</span><ChevronDown className="action-status-trigger-chevron" aria-hidden="true" />
  </button>;
}

const statusMenuExitDuration = 208;

export function ActionStatusToggle({ action, disabled, onToggleComplete, onOpenStatus }: {
  action: GoalAction;
  disabled?: boolean;
  onToggleComplete: () => void;
  onOpenStatus: () => void;
}) {
  const Icon = statusIcons[action.status];
  const label = `${action.status === "completed" ? "Przywróć" : "Ukończ"}: ${action.title}`;
  const hint = `${action.status === "completed" ? "Przywróć jako otwarte." : "Oznacz jako ukończone."} Status: ${actionStatusLabels[action.status]}. Przytrzymaj wiersz lub użyj Shift+Enter, aby zmienić status.`;
  const occurrence = describeActionOccurrence(action);

  return <button
    type="button"
    className={`action-status-trigger action-status-icon ${action.status}`}
    disabled={disabled}
    aria-label={occurrence ? `${label}, ${occurrence}` : label}
    aria-description={hint}
    aria-keyshortcuts="Shift+Enter"
    title={hint}
    onKeyDown={(event) => {
      if (event.key !== "Enter" || !event.shiftKey) return;
      event.preventDefault();
      if (!event.repeat) onOpenStatus();
    }}
    onClick={onToggleComplete}
  >
    <Icon className="action-status-glyph" aria-hidden="true" />
    {action.status === "ready" && <span className="action-complete-hint" aria-hidden="true">✓</span>}
  </button>;
}

export function ActionStatusDialog({ action, open, busy, error, compact = false, initialView = "statuses", menu = false, onClose, onChange }: {
  action?: GoalAction;
  open: boolean;
  busy: boolean;
  error?: string;
  compact?: boolean;
  initialView?: "statuses" | "blocker";
  menu?: boolean;
  onClose: () => void;
  onChange: (status: ProjectActionStatus, blocker?: string, reviewOn?: string | null) => Promise<boolean> | boolean;
}) {
  if (!action || !open) return null;
  return <ActionStatusDialogContent key={`${action.id}:${initialView}`} action={action} busy={busy} error={error} compact={compact} initialView={initialView} menu={menu} onClose={onClose} onChange={onChange} />;
}

function ActionStatusDialogContent({ action, busy, error, compact, initialView, menu, onClose, onChange }: {
  action: GoalAction;
  busy: boolean;
  error?: string;
  compact: boolean;
  initialView: "statuses" | "blocker";
  menu?: boolean;
  onClose: () => void;
  onChange: (status: ProjectActionStatus, blocker?: string, reviewOn?: string | null) => Promise<boolean> | boolean;
}) {
  const [editingBlocker, setEditingBlocker] = useState(initialView === "blocker");
  const [blocker, setBlocker] = useState(action.blocker ?? "");
  const [reviewOn, setReviewOn] = useState(action.reviewOn ?? "");
  const [menuPhase, setMenuPhase] = useState<"opening" | "open" | "closing">("opening");
  const closeTimer = useRef<number | undefined>(undefined);
  const hasMenu = Boolean(menu && !editingBlocker);
  const statusOptions = action.recurringTemplateId
    ? [...standardStatusOptions.slice(0, 5), "skipped" as const, "cancelled" as const]
    : standardStatusOptions;

  useEffect(() => {
    if (!hasMenu || menuPhase !== "opening") return;
    let expandFrame = 0;
    const initialFrame = window.requestAnimationFrame(() => {
      expandFrame = window.requestAnimationFrame(() => setMenuPhase("open"));
    });
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(expandFrame);
    };
  }, [hasMenu, menuPhase]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const closeMenu = (afterClose: () => void) => {
    if (closeTimer.current !== undefined) return;
    if (!hasMenu || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      afterClose();
      return;
    }
    setMenuPhase("closing");
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = undefined;
      setMenuPhase("opening");
      afterClose();
    }, statusMenuExitDuration);
  };

  const decide = async (status: ProjectActionStatus, nextBlocker?: string, nextReviewOn?: string | null) => {
    if (await onChange(status, nextBlocker, nextReviewOn)) closeMenu(onClose);
  };

  const options = !editingBlocker && <div className={`action-status-options${hasMenu ? " action-status-menu-options" : ""}`} role="group" aria-label="Nowy status Działania"
    data-phase={hasMenu ? menuPhase : undefined} style={hasMenu ? { "--status-last-index": statusOptions.length - 1 } as CSSProperties : undefined}>
    {statusOptions.map((status, index) => {
      const Icon = statusIcons[status];
      const current = action.status === status;
      return <button type="button" className={`action-status-option ${status}`} aria-pressed={current} disabled={busy || (current && status !== "blocked")} key={status}
        style={hasMenu ? { "--status-index": index } as CSSProperties : undefined}
        onClick={() => {
          if (closeTimer.current !== undefined) return;
          if (status === "blocked") closeMenu(() => setEditingBlocker(true));
          else void decide(status);
        }}>
        <Icon className="action-status-glyph" aria-hidden="true" />
        <span><strong>{actionStatusLabels[status]}</strong>{!hasMenu ? <small>{statusHints[status]}</small> : null}</span>
        {current && !hasMenu ? <em>Aktualny</em> : null}
      </button>;
    })}
  </div>;
  const statusError = error ? <p className="inline-mutation-error" role="alert">{error}</p> : null;

  return <Modal open closeDisabled={busy || menuPhase === "closing"} scrollLock={menu ? "viewport" : "body"} showHeader={!hasMenu} backdropClassName={hasMenu ? "action-status-menu-backdrop" : undefined} className={`action-form-dialog action-status-dialog${compact ? " compact" : ""}${action.recurringTemplateId ? " has-routine-origin" : ""}`} title="Zmień status Działania" onClose={() => closeMenu(onClose)}>
    {hasMenu ? <>{options}{statusError}</> : <div className="action-form-body" data-modal-scroll-body>
      <p className="modal-intro"><strong>{action.title}</strong>{action.recurringTemplateId ? <ActionOriginMarker action={action} verbose /> : null}</p>
      {editingBlocker ? <div className="action-status-blocker"><label className="field-label" htmlFor={`action-status-blocker-${action.id}`}>Co blokuje to Działanie?</label><textarea id={`action-status-blocker-${action.id}`} rows={3} value={blocker} disabled={busy} onChange={(event) => setBlocker(event.target.value)} placeholder="Np. czekam na decyzję lub dostęp" required /><label className="field-label" htmlFor={`action-status-review-${action.id}`}>Sprawdź ponownie <span className="optional-label">opcjonalnie</span></label><input id={`action-status-review-${action.id}`} type="date" value={reviewOn} disabled={busy} onChange={(event) => setReviewOn(event.target.value)} /><p className="muted-copy">To dzień powrotu do blokady, niezależny od terminu wykonania Działania.</p></div> : options}
      {statusError}
    </div>}
    {editingBlocker ? <div className="modal-actions"><Button disabled={busy} onClick={() => setEditingBlocker(false)}>Wróć</Button><Button variant="primary" loading={busy} disabled={!blocker.trim()} onClick={() => void decide("blocked", blocker.trim(), reviewOn || null)}>Zapisz blokadę</Button></div> : null}
  </Modal>;
}
