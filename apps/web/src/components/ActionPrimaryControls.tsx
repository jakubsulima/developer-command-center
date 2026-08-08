import { Check, Circle } from "lucide-react";
import type { GoalAction } from "../domain/types";
import { Button } from "./ui";

export function ActionPrimaryControls({ action, busy, onToggleComplete, onSetNext, onMore }: {
  action: GoalAction;
  busy: boolean;
  onToggleComplete: () => void;
  onSetNext?: () => void;
  onMore: () => void;
}) {
  const canBeNext = Boolean(action.goalId && onSetNext && ["ready", "in_progress"].includes(action.status));

  return <>
    <button
      className="action-check"
      disabled={busy}
      aria-busy={busy}
      aria-label={action.status === "completed" ? `Przywróć: ${action.title}` : `Ukończ: ${action.title}`}
      onClick={onToggleComplete}
    >
      {action.status === "completed" ? <Check /> : <Circle />}
    </button>
    <div className="mobile-action-primary">
      {canBeNext ? <Button
        className="mobile-action-next"
        variant="ghost"
        aria-pressed={action.isNext}
        disabled={action.isNext || busy}
        onClick={onSetNext}
      >{action.isNext ? "Następne" : "Ustaw następne"}</Button> : null}
      <Button className="mobile-action-more" variant="ghost" aria-label={`Więcej opcji: ${action.title}`} disabled={busy} onClick={onMore}>Więcej</Button>
    </div>
  </>;
}
