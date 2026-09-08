import { ArrowRight, BookMarked, CalendarCheck, Check, CheckCircle2, Lightbulb, ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { DraftStatus } from "../components/DraftStatus";
import { Badge, Button, Panel } from "../components/ui";
import { deriveWeeklyReview } from "../domain/weeklyReview";
import { blockedActions } from "../domain/weeklyReview";
import { formatWorkspaceDateRange } from "../domain/activity";
import { polishCount, polishPluralForm } from "../domain/labels";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { mergePagedItems, useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import type { ReviewRecord } from "../domain/types";
import { AIGoalReview } from "../components/AIGoalReview";

const reviewFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });

export function ReviewPage() {
  const { state, completeReview } = useStore();
  const reviewsPage = useWorkspaceInfinitePage<ReviewRecord>("reviews", 20);
  const draft = usePersistentDraft("weekly-review-note", { note: "" });
  const weekly = useMemo(() => deriveWeeklyReview(state), [state]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const completedThisWeek = state.reviews.some((review) => review.type === "weekly" && new Date(review.completedAt) >= weekly.start && new Date(review.completedAt) < weekly.end);
  const activeGoalCount = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").length;
  const blockedCount = blockedActions(state).length;
  const inboxCount = state.inbox.filter((item) => item.status === "unprocessed").length;
  const reviewHistory = mergePagedItems(state.reviews, reviewsPage.data?.items ?? [])
    .filter((review) => review.type === "weekly")
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));

  const complete = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    const note = draft.value.note.trim();
    const summary = note ? `${weekly.generatedSummary}\n\nDecyzja na kolejny tydzień: ${note}` : weekly.generatedSummary;
    const saved = await completeReview(summary, "weekly", {
      completedActions: String(weekly.completedActions),
      knowledgeAdded: String(weekly.knowledgeAdded),
      progressUpdates: String(weekly.progressUpdates)
    });
    if (saved) draft.clear();
    else setError("Nie udało się zapisać podsumowania. Twoja notatka pozostała zachowana.");
    setSaving(false);
  };

  return (
    <AppShell>
      <PageHeading
        title="Podsumowanie tygodnia"
        eyebrow={`${formatWorkspaceDateRange(weekly.startDate, weekly.endDate)} · aktualizuje się automatycznie`}
        action={completedThisWeek ? <Badge tone="success"><Check />Zapisane</Badge> : <Badge tone="neutral"><RefreshCw />Na żywo</Badge>}
      />
      <div className="review-layout weekly-review-layout">
        <div className="review-main-column">
          <Panel className="review-main weekly-summary-card">
            <div className="review-intro"><span className="review-intro-icon"><Sparkles /></span><span><small>Podsumowanie systemowe</small><h2>Ten tydzień w skrócie</h2><p>{weekly.generatedSummary}</p></span></div>
            <div className="weekly-metrics" aria-label="Wyniki tygodnia">
              <div><CheckCircle2 /><span><strong>{weekly.completedActions}</strong><small>{polishPluralForm(weekly.completedActions, "ukończone Działanie", "ukończone Działania", "ukończonych Działań")}</small></span></div>
              <div><BookMarked /><span><strong>{weekly.knowledgeAdded}</strong><small>{polishPluralForm(weekly.knowledgeAdded, "dodany element Wiedzy", "dodane elementy Wiedzy", "dodanych elementów Wiedzy")}</small></span></div>
              <div><ListChecks /><span><strong>{weekly.progressUpdates}</strong><small>{polishPluralForm(weekly.progressUpdates, "aktualizacja postępu", "aktualizacje postępu", "aktualizacji postępu")}</small></span></div>
            </div>
          </Panel>

          <AIGoalReview />

          <Panel className="weekly-suggestions">
            <div className="section-heading"><div><span className="section-kicker"><Lightbulb />Sugestie</span><h2>Co warto zrobić dalej</h2></div><span>{polishCount(weekly.suggestions.length, "priorytet", "priorytety", "priorytetów")}</span></div>
            <div className="weekly-suggestion-list">
              {weekly.suggestions.map((suggestion, index) => <Link key={suggestion.id} to={suggestion.to}>
                <span className="suggestion-number">{index + 1}</span>
                <span><strong>{suggestion.title}</strong><small>{suggestion.detail}</small></span>
                <ArrowRight />
              </Link>)}
            </div>
          </Panel>

          <Panel className="weekly-decision">
            <div className="section-heading"><div><span className="section-kicker"><CalendarCheck />Twoja decyzja</span><h2>Ustaw kierunek na kolejny tydzień</h2></div></div>
            <p>Podsumowanie jest gotowe. Dopisz tylko jedną decyzję, jeśli chcesz — nie musisz wypełniać checklisty.</p>
            <label className="field-label" htmlFor="review-note">Najważniejsza decyzja <span className="optional-label">opcjonalnie</span></label>
            <textarea id="review-note" rows={3} placeholder="Np. Najpierw odblokowuję budżet, pozostałe Cele czekają." value={draft.value.note} onChange={(event) => draft.setValue({ note: event.target.value })} />
            {error ? <p className="auth-message error" role="alert">{error}</p> : null}
            <div className="weekly-decision-footer"><div><DraftStatus status={draft.status} />{draft.dirty ? <Button variant="ghost" onClick={draft.discard}>Wyczyść</Button> : null}</div><Button variant="primary" loading={saving} onClick={() => void complete()}><Check />{completedThisWeek ? "Zapisz ponownie" : "Zamknij tydzień"}</Button></div>
          </Panel>
        </div>

        <aside className="review-side">
          <Panel><h2>Historia tygodni</h2>{reviewsPage.isPending ? <p className="muted-copy">Ładowanie historii…</p> : reviewHistory.length ? reviewHistory.map((review) => <div className="review-history-item" key={review.id}><strong>Podsumowanie zapisane</strong><small>{reviewFormatter.format(new Date(review.completedAt))}</small><p>{review.summary || "Bez dodatkowej decyzji."}</p></div>) : <p className="muted-copy">Pierwsze zapisane podsumowanie pojawi się tutaj.</p>}{reviewsPage.isError && reviewHistory.length ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać dalszej historii.</p> : null}{reviewHistory.length && reviewsPage.hasNextPage ? <Button loading={reviewsPage.isFetchingNextPage} onClick={() => void reviewsPage.fetchNextPage()}>Załaduj starsze</Button> : null}</Panel>
          <Panel><h2><RefreshCw />Stan na teraz</h2><div className="review-state-list"><p><strong>{activeGoalCount}</strong><span>{polishPluralForm(activeGoalCount, "aktywny Cel", "aktywne Cele", "aktywnych Celów")}</span></p><p><strong>{blockedCount}</strong><span>{polishPluralForm(blockedCount, "blokada", "blokady", "blokad")}</span></p><p><strong>{inboxCount}</strong><span>{polishPluralForm(inboxCount, "element w Skrzynce", "elementy w Skrzynce", "elementów w Skrzynce")}</span></p></div></Panel>
        </aside>
      </div>
    </AppShell>
  );
}
