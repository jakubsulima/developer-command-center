import { useRef, useState, type FormEvent, type Ref } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import type { Goal } from "../domain/types";
import { normalizeQuickAddContext } from "../domain/quickAdd";
import { useCreationDraft } from "./useCreationDraft";
import { useCreationReceipt } from "./useCreationReceipt";
import { requestAppQuickAdd } from "./appQuickAddRequest";
import { DraftStatus } from "./DraftStatus";
import { DraftRecovery } from "./DraftRecovery";
import { useActionFeedback } from "./action-feedback-context";
import { Button } from "./ui";
import { restartRejectedDraft } from "./creationDraft";
import { isOperationRejected } from "../lib/operationFailure";

export function InlineGoalAction({ goal, inputRef }: { goal: Goal; inputRef?: Ref<HTMLInputElement> }) {
  const request = { mode: "action" as const, goalId: goal.id, areaId: goal.areaId, draftKey: `goal-${goal.id}` };
  const draft = useCreationDraft(request);
  const completion = useCreationReceipt(draft.storageKey, { value: draft.value.receipt, save: (receipt) => { draft.setValue((current) => ({ ...current, receipt })); return draft.flush(); } });
  const { state, createAction } = useStore();
  const { notifySuccess } = useActionFeedback();
  const navigate = useNavigate();
  const locked = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked.current || completion.receipt || !draft.value.title.trim()) return;
    const value = structuredClone(draft.value);
    const context = normalizeQuickAddContext({ mode: "action", goalId: value.context.startsWith("goal:") ? value.context.slice(5) : undefined, areaId: value.context.startsWith("area:") ? value.context.slice(5) : undefined, activeGoals: state.goals, activeAreas: state.areas });
    if (context.unavailable) { setError("Powiązanie jest niedostępne. Otwórz więcej szczegółów i zmień kontekst."); return; }
    draft.setValue((current) => ({ ...current, attempted: true }));
    if (!draft.flush()) { draft.setValue((current) => ({ ...current, attempted: value.attempted })); return; }
    locked.current = true; setSaving(true); setError("");
    let confirmed = false;
    try {
      const id = await createAction({ title: value.title.trim(), detail: value.detail.trim(), scheduledFor: value.scheduledFor || undefined, pinnedToToday: value.pinnedToToday, goalId: context.goalId, areaId: context.areaId }, value.knowledgeIdempotencyKey);
      confirmed = true;
      const receipt = { id, url: `/actions/${id}`, message: "Działanie dodane." };
      completion.remember(receipt);
      if (!completion.finish(() => draft.clear({ ...draft.initial, knowledgeIdempotencyKey: crypto.randomUUID() }))) { setError("Działanie zapisano. Usuń zapisany szkic."); return; }
      notifySuccess(receipt.message, { label: "Otwórz", onClick: () => navigate(receipt.url) });
    } catch (caught) {
      const canCorrect = !confirmed && !value.attempted && isOperationRejected(caught);
      if (canCorrect) {
        draft.setValue(restartRejectedDraft(value));
        draft.flush();
      }
      setError(canCorrect ? "Zapis został odrzucony. Popraw pola lub powiązania i spróbuj ponownie." : caught instanceof Error ? caught.message : "Nie udało się zapisać Działania.");
    }
    finally { locked.current = false; setSaving(false); }
  };
  return <form className="inline-create" onSubmit={(event) => void submit(event)}>
    <input ref={inputRef} aria-label="Nowe Działanie" placeholder="Dodaj konkretny krok…" disabled={saving || Boolean(completion.receipt) || draft.value.attempted} value={draft.value.title} onChange={(event) => draft.setValue((current) => ({ ...current, title: event.target.value }))} required />
    <input aria-label="Termin Działania" type="date" disabled={saving || Boolean(completion.receipt) || draft.value.attempted} value={draft.value.scheduledFor} onChange={(event) => draft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} />
    <Button type="submit" loading={saving} disabled={!draft.value.title.trim() || Boolean(completion.receipt)}>Dodaj</Button>
    <Button type="button" variant="ghost" disabled={saving} onClick={() => { if (draft.flush()) requestAppQuickAdd(request); }}>Więcej szczegółów</Button>
    <DraftStatus compact status={draft.status} restored={draft.restored} errorMessage={draft.errorMessage} onRetry={draft.retry} />
    <DraftRecovery alternatives={draft.alternatives} recover={draft.recover} disabled={saving || Boolean(completion.receipt) || draft.value.attempted} />
    {completion.receipt ? <Button type="button" onClick={() => { if (completion.finish(draft.clear)) setError(""); }}>Usuń zapisany szkic</Button> : null}
    {error ? <p role="alert">{error}</p> : null}
  </form>;
}
