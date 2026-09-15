import { Check, Circle, MoreHorizontal } from "lucide-react";
import type { GoalAction } from "../domain/types";
import { Button } from "./ui";

export function ActionOverflowButton({ action, busy, onClick }: { action: GoalAction; busy: boolean; onClick: () => void }) {
  return <Button className="mobile-action-more" variant="ghost" aria-label={`Więcej opcji: ${action.title}`} title="Więcej opcji" disabled={busy} onClick={onClick}><MoreHorizontal /></Button>;
}

export function ActionPrimaryControls({ action, busy, onToggleComplete, onMore, ariaLabelPrefix = "Ukończ" }: {
  action: GoalAction;
  busy: boolean;
  onToggleComplete: () => void;
  onMore?: () => void;
  ariaLabelPrefix?: string;
}) {
  return <>
    <button
      className="action-check"
      disabled={busy}
      aria-busy={busy}
      aria-label={action.status === "completed" ? `Przywróć: ${action.title}` : `${ariaLabelPrefix}: ${action.title}`}
      onClick={onToggleComplete}
    >
      {action.status === "completed" ? <Check /> : <Circle />}
    </button>
    {onMore ? <div className="mobile-action-primary"><ActionOverflowButton action={action} busy={busy} onClick={onMore} /></div> : null}
  </>;
}
