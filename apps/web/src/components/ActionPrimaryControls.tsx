import { Check, Circle, MoreHorizontal } from "lucide-react";
import type { GoalAction } from "../domain/types";
import { Button } from "./ui";

export function ActionPrimaryControls({ action, busy, onToggleComplete, onMore, ariaLabelPrefix = "Ukończ" }: {
  action: GoalAction;
  busy: boolean;
  onToggleComplete: () => void;
  onMore: () => void;
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
    <div className="mobile-action-primary">
      <Button className="mobile-action-more" variant="ghost" aria-label={`Więcej opcji: ${action.title}`} title="Więcej opcji" disabled={busy} onClick={onMore}><MoreHorizontal /></Button>
    </div>
  </>;
}
