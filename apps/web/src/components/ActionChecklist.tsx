import { useId, useState } from "react";
import { useStore } from "../app/useStore";
import type { GoalAction } from "../domain/types";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import "./action-checklist.css";

type ChecklistChange = { id: string; completed: boolean };

export function ActionChecklist({ action, busy = false, collapsible = false }: {
  action: GoalAction;
  busy?: boolean;
  collapsible?: boolean;
}) {
  const { updateAction } = useStore();
  const mutation = useKeyedMutation();
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [lastChange, setLastChange] = useState<ChecklistChange>();
  const completeCount = action.checklist.filter((entry) => entry.completed).length;
  const readOnly = ["completed", "cancelled", "skipped"].includes(action.status);
  const disabled = busy || readOnly || mutation.isBusy(action.id);
  const error = mutation.error(action.id);

  if (!action.checklist.length) return null;

  const changeItem = (change: ChecklistChange) => {
    if (disabled) return;
    setLastChange(change);
    void mutation.run(action.id, async () => {
      const item = action.checklist.find((entry) => entry.id === change.id);
      if (!item || item.completed === change.completed) return;
      const checklist = action.checklist.map((entry) => entry.id === change.id ? { ...entry, completed: change.completed } : entry);
      await updateAction(action.id, { checklist }, action.version);
    });
  };

  return <div className="action-checklist">
    {collapsible
      ? <button type="button" className="action-checklist-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((current) => !current)}>Checklista {completeCount}/{action.checklist.length}</button>
      : <p className="action-checklist-progress">{completeCount} z {action.checklist.length} ukończonych</p>}
    <div id={contentId} hidden={collapsible && !expanded}>
      <ul className="action-checklist-entries">
        {action.checklist.map((entry) => <li key={entry.id}>
          <label><input type="checkbox" checked={entry.completed} disabled={disabled} onChange={(event) => changeItem({ id: entry.id, completed: event.target.checked })} /><span>{entry.title}</span></label>
        </li>)}
      </ul>
      {error && lastChange ? <p className="inline-mutation-error" role="alert">{error} <button type="button" disabled={disabled} onClick={() => changeItem(lastChange)}>Spróbuj ponownie</button></p> : null}
    </div>
  </div>;
}
