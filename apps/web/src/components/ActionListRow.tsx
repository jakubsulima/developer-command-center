import { useEffect, useRef, type ComponentPropsWithoutRef, type MouseEventHandler, type PointerEvent, type ReactNode, type RefCallback } from "react";
import { navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import type { GoalAction } from "../domain/types";
import { ActionSignals } from "./ActionSignals";
import { ActionStatusToggle } from "./ActionStatusControls";
import { NavigationLink } from "./ContextNavigation";
import "./workspace-list.css";
import "./action-list-row.css";

const statusHoldDuration = 500;
const statusHoldMoveTolerance = 8;

export function ActionListRow({
  as: Row = "li", action, navigation, cardId = navigationCardId("action", action.id),
  timeZone, today, routineTitle, onOpenStatus, onToggleComplete, busy, showUnscheduled,
  linkLabel, onTitleClick, context, indicator, description, tools, children, className = "", ...props
}: ComponentPropsWithoutRef<"section"> & {
  as?: "li" | "div" | "section";
  ref?: RefCallback<HTMLElement>;
  action: GoalAction;
  navigation: { breadcrumbs: NavigationBreadcrumb[]; returnTo: string; returnLabel: string };
  cardId?: string;
  timeZone: string;
  today: string;
  routineTitle?: string;
  onOpenStatus: () => void;
  onToggleComplete: () => void;
  busy?: boolean;
  showUnscheduled?: boolean;
  linkLabel?: string;
  onTitleClick?: MouseEventHandler<HTMLAnchorElement>;
  context?: { label: string; to?: string };
  indicator?: ReactNode;
  description?: string;
  tools?: ReactNode;
}) {
  const press = useRef<{ pointerId: number; x: number; y: number; timer: number } | undefined>(undefined);
  const suppressClick = useRef(false);

  useEffect(() => () => window.clearTimeout(press.current?.timer), []);

  const endPress = (event: PointerEvent<HTMLElement>, cancelled = false) => {
    const activePress = press.current;
    if (!activePress || activePress.pointerId !== event.pointerId) return;
    window.clearTimeout(activePress.timer);
    press.current = undefined;
    if (cancelled) suppressClick.current = true;
  };

  return <Row {...props} className={`action-list-row ${action.status} ${className}`} data-action-id={action.id} data-navigation-card-id={cardId} tabIndex={-1}
    onPointerDown={(event) => {
      if (!event.isPrimary || event.button !== 0) return;
      window.clearTimeout(press.current?.timer);
      press.current = undefined;
      suppressClick.current = false;
      const target = event.target;
      if (busy || !(target instanceof Element) || target.closest("a:not(.action-list-row-title), button:not(.action-status-icon), input, textarea, select, label, summary, [contenteditable]")) return;
      const row = event.currentTarget;
      const statusButton = row.querySelector<HTMLButtonElement>(".action-status-icon");
      const trigger = target.closest<HTMLElement>("a, button") ?? statusButton;
      const timer = window.setTimeout(() => {
        if (statusButton?.disabled) return;
        suppressClick.current = true;
        trigger?.focus({ preventScroll: true });
        onOpenStatus();
      }, statusHoldDuration);
      press.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer };
    }}
    onPointerMove={(event) => {
      const activePress = press.current;
      if (activePress && Math.hypot(event.clientX - activePress.x, event.clientY - activePress.y) > statusHoldMoveTolerance) endPress(event, true);
    }}
    onPointerUp={endPress}
    onPointerLeave={(event) => endPress(event, true)}
    onPointerCancel={(event) => endPress(event, true)}
    onContextMenu={(event) => {
      if (press.current || suppressClick.current) event.preventDefault();
    }}
    onClickCapture={(event) => {
      if (event.detail === 0 || !suppressClick.current) return;
      event.preventDefault();
      event.stopPropagation();
    }}>
    <span className="action-list-row-status">
      <ActionStatusToggle action={action} disabled={busy} onToggleComplete={onToggleComplete} onOpenStatus={onOpenStatus} />
    </span>
    <div className="action-list-row-copy">
      <NavigationLink className="action-list-row-title" to={`/actions/${encodeURIComponent(action.id)}`} {...navigation} sourceCardId={cardId} aria-label={linkLabel} onClick={onTitleClick}>
        <strong>{action.title}</strong>
      </NavigationLink>
      {indicator}
      {context ? <small className="action-list-row-context">
        {context.to ? <NavigationLink to={context.to} {...navigation} sourceCardId={cardId}>{context.label}</NavigationLink> : context.label}
      </small> : null}
      <ActionSignals action={action} timeZone={timeZone} today={today} routineTitle={routineTitle} showStatus={false} showUnscheduled={showUnscheduled} />
      {description ? <small className="action-list-row-description">{description}</small> : null}
      {children}
    </div>
    {tools ? <div className="action-list-row-tools">{tools}</div> : null}
  </Row>;
}
