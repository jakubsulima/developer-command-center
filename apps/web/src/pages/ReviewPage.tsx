import { CalendarCheck, Check, CheckCircle2, Circle, Compass, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Badge, Button, Panel } from "../components/ui";
import { DraftStatus } from "../components/DraftStatus";
import { usePersistentDraft } from "../hooks/usePersistentDraft";

const weeklyQuestions = [
  { id: "close", title: "Zamknij otwarte wątki", detail: "Czy każdy aktywny projekt ma konkretny następny krok?", icon: CheckCircle2 },
  { id: "outcomes", title: "Sprawdź outcomes", detail: "Czy rezultaty nadal opisują zmianę, którą chcesz osiągnąć?", icon: Compass },
  { id: "wip", title: "Oceń WIP", detail: "Czy trzy aktywne commitments to właściwy limit na kolejny tydzień?", icon: Scale },
  { id: "risks", title: "Nazwij ryzyka", detail: "Który blocker wymaga decyzji zamiast kolejnego zadania?", icon: ShieldAlert }
];
const dailyQuestions = [
  { id: "focus", title: "Odzyskaj kontekst", detail: "Czy następna fizyczna akcja jest nadal właściwa?", icon: Compass },
  { id: "inbox", title: "Opróżnij pilne Capture", detail: "Czy w Inboxie zostało coś blokującego jutro?", icon: CheckCircle2 },
  { id: "blocker", title: "Nazwij blocker", detail: "Czy potrzebujesz decyzji przed kolejną sesją?", icon: ShieldAlert }
];
const reviewFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const emptyReviewDraft: { reviewType: "daily" | "weekly"; checked: string[]; summary: string } = { reviewType: "weekly", checked: [], summary: "" };

export function ReviewPage() {
  const { state, completeReview } = useStore();
  const draft = usePersistentDraft("review-summary", emptyReviewDraft);
  const { reviewType, checked, summary } = draft.value;
  const questions = reviewType === "weekly" ? weeklyQuestions : dailyQuestions;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const signals = state.projects.filter((project) => project.blocker || project.status !== "W trakcie");
  const toggle = (id: string) => draft.setValue((current) => ({ ...current, checked: current.checked.includes(id) ? current.checked.filter((item) => item !== id) : [...current.checked, id] }));
  const complete = async () => {
    if (checked.length !== questions.length) return;
    setSaving(true);
    setError("");
    const saved = await completeReview(summary, reviewType, Object.fromEntries(questions.map((question) => [question.id, checked.includes(question.id) ? "confirmed" : "skipped"])));
    if (saved) draft.clear();
    else setError("Nie udało się zapisać Review. Wersja robocza pozostała zachowana.");
    setSaving(false);
  };

  return (
    <AppShell>
      <PageHeading title="Przegląd tygodnia" eyebrow="Review prowadzi do decyzji, nie do raportu" action={state.reviewCompletedAt && <Badge tone="success"><Check />Ukończony</Badge>} />
      <div className="review-layout">
        <Panel className="review-main">
          <div className="review-intro"><CalendarCheck /><span><h2>Przygotuj kolejny tydzień</h2><p>Potwierdź kierunek, uwolnij nieaktualne zobowiązania i zapisz decyzje.</p></span></div>
          <label className="field-label" htmlFor="review-type">Typ przeglądu</label>
          <select id="review-type" value={reviewType} onChange={(event) => draft.setValue({ reviewType: event.target.value as typeof reviewType, checked: [], summary: "" })}><option value="daily">Daily Review</option><option value="weekly">Weekly Review</option></select>
          <div className="review-questions">{questions.map(({ id, title, detail, icon: Icon }) => {
            const isChecked = checked.includes(id);
            return <button className={isChecked ? "checked" : ""} onClick={() => toggle(id)} key={id}><span className="review-check">{isChecked ? <Check /> : <Circle />}</span><Icon /><span><strong>{title}</strong><small>{detail}</small></span></button>;
          })}</div>
          <label className="field-label" htmlFor="review-summary">{reviewType === "weekly" ? "Najważniejsza decyzja na kolejny tydzień" : "Najważniejsza decyzja"}</label>
          <textarea id="review-summary" rows={5} placeholder="Co zachowujesz, co ograniczasz i co wymaga ponownej oceny?" value={summary} onChange={(event) => draft.setValue((current) => ({ ...current, summary: event.target.value }))} />
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <div className="draft-row"><DraftStatus status={draft.status} />{draft.dirty && <Button variant="ghost" onClick={draft.discard}>Odrzuć wersję roboczą</Button>}</div>
          <div className="review-actions"><span>{checked.length} z {questions.length} kroków</span><Button variant="primary" loading={saving} disabled={checked.length !== questions.length} onClick={() => void complete()}><Check />Zakończ przegląd</Button></div>
        </Panel>
        <aside className="review-side">
          <Panel><h2>Historia Review</h2>{state.reviews.length ? [...state.reviews].reverse().map((review) => <div className="review-history-item" key={review.id}><strong>{review.type === "daily" ? "Daily Review" : "Weekly Review"} • ukończony</strong><small>{reviewFormatter.format(new Date(review.completedAt))}</small><p>{review.summary || "Jawnie potwierdzono brak zmian."}</p></div>) : <p>Brak ukończonych przeglądów.</p>}</Panel>
          <Panel><h2>Aktywne commitments</h2>{state.projects.map((project) => <div className="review-project" key={project.id}><span className={`project-avatar ${project.color}`}>{project.initials}</span><span><strong>{project.name}</strong><small>{project.primary ? "Primary" : project.status}</small></span></div>)}</Panel>
          <Panel><h2><RefreshCw />Sygnały do decyzji</h2>{signals.length ? signals.map((project) => <p key={project.id}><strong>{project.name}</strong> — {project.blocker ?? project.status}.</p>) : <p>Brak blockerów i projektów oczekujących na decyzję.</p>}</Panel>
        </aside>
      </div>
    </AppShell>
  );
}
