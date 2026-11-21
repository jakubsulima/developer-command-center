import type { ComponentPropsWithoutRef, MouseEventHandler, ReactNode, RefCallback } from "react";
import { navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import type { GoalAction } from "../domain/types";
import { ActionSignals } from "./ActionSignals";
import { ActionStatusTrigger } from "./ActionStatusControls";
import { NavigationLink } from "./ContextNavigation";
import "./workspace-list.css";
import "./action-list-row.css";

export function ActionListRow({
  as: Row = "li", action, navigation, cardId = navigationCardId("action", action.id),
  timeZone, today, routineTitle, onOpenStatus, busy, showUnscheduled,
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
  busy?: boolean;
  showUnscheduled?: boolean;
  linkLabel?: string;
  onTitleClick?: MouseEventHandler<HTMLAnchorElement>;
  context?: { label: string; to?: string };
  indicator?: ReactNode;
  description?: string;
  tools?: ReactNode;
}) {
  return <Row {...props} className={`action-list-row ${action.status} ${className}`} data-action-id={action.id} data-navigation-card-id={cardId} tabIndex={-1}>
    <span className="action-list-row-status">
      <ActionStatusTrigger action={action} density="icon" disabled={busy ?? false} onClick={onOpenStatus} />
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
