import { CalendarClock, LockKeyhole, Repeat2 } from "lucide-react";
import { describeActionSchedule } from "../domain/actionPresentation";
import type { GoalAction } from "../domain/types";
import { ActionStatusTrigger } from "./ActionStatusControls";

export function ActionSignals({ action, timeZone, today, routineTitle, density = "list", disabled = false, onOpenStatus }: {
  action: GoalAction;
  timeZone: string;
  today: string;
  routineTitle?: string;
  density?: "compact" | "list" | "detail";
  disabled?: boolean;
  onOpenStatus?: () => void;
}) {
  return <div className={`action-signals action-signals-${density}`}>
    <ActionStatusTrigger action={action} density={density} disabled={disabled || !onOpenStatus} onClick={onOpenStatus ?? (() => undefined)} />
    <span className={`action-signal action-schedule${action.scheduledFor && action.scheduledFor < today ? " overdue" : ""}`}><CalendarClock aria-hidden="true" />{describeActionSchedule(action, today, timeZone, density === "detail" ? "detail" : "compact")}</span>
    {action.status === "blocked" && action.blocker ? <span className="action-blocker-signal" title={action.blocker}><LockKeyhole aria-hidden="true" /><span><strong>Blokada</strong>{action.blocker}</span></span> : null}
    {routineTitle ? <span className="action-signal action-routine-signal"><Repeat2 aria-hidden="true" />{routineTitle}</span> : null}
  </div>;
}
