import { Check } from "lucide-react";
import { useStore } from "../app/useStore";
import { resolveActionContext, describeActionContext } from "../domain/actionContext";
import { resolveRoutineTitle } from "../domain/actionPresentation";
import { navigationCardId } from "../domain/navigation";
import type { GoalAction } from "../domain/types";
import { ActionSignals } from "./ActionSignals";
import { ActionChecklist } from "./ActionChecklist";
import { NavigationLink } from "./ContextNavigation";
import { Button } from "./ui";
import { PreviewPanel } from "./PreviewPanel";

export function ActionPreview({ action, today, returnTo, busy, error, onClose, onOpenStatus, onComplete, onRetry }: {
  action: GoalAction;
  today: string;
  returnTo: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onOpenStatus: () => void;
  onComplete: () => void;
  onRetry: () => void;
}) {
  const { state } = useStore();
  const context = resolveActionContext(action, state);
  const breadcrumbs = [{ label: "Działania", to: returnTo }];
  const sourceCardId = navigationCardId("action", action.id);
  const knowledgeIds = new Set(state.knowledgeLinks.filter((link) => link.actionId === action.id).map((link) => link.knowledgeItemId));
  const knowledge = state.knowledge.filter((item) => knowledgeIds.has(item.id) && !item.archivedAt && !item.trashedAt);
  const canComplete = !["completed", "cancelled", "skipped", "blocked"].includes(action.status);

  return <PreviewPanel id="action-preview" className="actions-preview" label="Podgląd Działania" title={action.title} focusKey={action.id} onClose={onClose}>
    <ActionSignals action={action} today={today} timeZone={state.workspaceTimezone} routineTitle={resolveRoutineTitle(action, state.recurringActionTemplates)} density="detail" disabled={busy} onOpenStatus={onOpenStatus} />
    <div className="actions-preview-context">{context.to !== "/" ? <NavigationLink to={context.to} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Wszystkie Działania" sourceCardId={sourceCardId}>{describeActionContext(context)}</NavigationLink> : describeActionContext(context)}</div>
    {action.status === "blocked" ? <section className="actions-preview-blocker"><h3>Co blokuje Działanie?</h3><p>{action.blocker || "Nie podano powodu."}</p></section> : null}
    <section className="actions-preview-description"><h3>Opis</h3><p>{action.detail || "Brak opisu. Możesz go dodać w pełnym widoku Działania."}</p></section>
    {action.checklist.length ? <section><h3>Lista kroków</h3><ActionChecklist key={action.id} action={action} busy={busy} /></section> : null}
    {knowledge.length ? <section><h3>Powiązana Wiedza</h3><ul className="actions-preview-knowledge">{knowledge.map((item) => <li key={item.id}><NavigationLink to={`/knowledge/${encodeURIComponent(item.id)}`} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Wszystkie Działania" sourceCardId={sourceCardId}>{item.title}</NavigationLink></li>)}</ul></section> : null}
    {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={onRetry}>Spróbuj ponownie</button></p> : null}
    <div className="actions-preview-footer">
      {canComplete ? <Button variant="primary" loading={busy} onClick={onComplete}><Check aria-hidden="true" />Ukończ Działanie</Button> : action.status === "blocked" ? <Button variant="primary" disabled={busy} onClick={onOpenStatus}>Zdecyduj co dalej</Button> : null}
      <NavigationLink className="button button-secondary" to={`/actions/${encodeURIComponent(action.id)}`} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Wszystkie Działania" sourceCardId={sourceCardId}>Otwórz pełny widok</NavigationLink>
    </div>
  </PreviewPanel>;
}
