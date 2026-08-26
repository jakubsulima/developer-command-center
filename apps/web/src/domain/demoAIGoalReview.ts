import type { AppState, Goal } from "./types";
import type { AIGoalReview, AIGoalReviewRecommendation, AIGoalStatus } from "./aiGoalReview";
import { AI_GOAL_REVIEW_SCHEMA_VERSION } from "./aiGoalReview";
import { activeGoalsWithoutNextAction, isOpenAction } from "./weeklyReview";

function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

function goalSignals(state: AppState, goal: Goal, now: Date) {
  const today = day(now);
  const actions = state.actions.filter((action) => action.goalId === goal.id && isOpenAction(action));
  const signals: string[] = [];
  if (!actions.some((action) => action.isNext && ["ready", "in_progress"].includes(action.status))) signals.push(`goal:${goal.id}:missing-next-action`);
  if (!state.goalCriteria.some((criterion) => criterion.goalId === goal.id)) signals.push(`goal:${goal.id}:missing-criteria`);
  const blocked = actions.filter((action) => action.status === "blocked");
  if (blocked.length) signals.push(`goal:${goal.id}:blocked:${blocked.length}`);
  const overdue = actions.filter((action) => action.scheduledFor && action.scheduledFor < today);
  if (overdue.length) signals.push(`goal:${goal.id}:overdue-actions:${overdue.length}`);
  if (goal.targetDate && goal.targetDate < today) signals.push(`goal:${goal.id}:overdue-goal`);
  else if (goal.targetDate && goal.targetDate <= day(new Date(now.getTime() + 7 * 86_400_000))) signals.push(`goal:${goal.id}:due-soon`);
  if (actions.length > 5) signals.push(`goal:${goal.id}:too-many-open-actions:${actions.length}`);
  return signals;
}

function assessmentStatus(signals: string[]): AIGoalStatus {
  if (signals.some((signal) => signal.includes(":blocked:") || signal.endsWith(":overdue-goal"))) return "stuck";
  if (signals.length) return "attention";
  return "on_track";
}

export function createDemoAIGoalReview(state: AppState, now = new Date()): AIGoalReview {
  const activeGoals = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active");
  if (!activeGoals.length) throw Object.assign(new Error("Nie ma aktywnych Celów do analizy."), { code: "NO_ACTIVE_GOALS" });
  const analyzed = activeGoals.slice(0, 50);
  const omitted = activeGoals.slice(50);
  const signalMap = new Map(analyzed.map((goal) => [goal.id, goalSignals(state, goal, now)]));
  const recommendations: AIGoalReviewRecommendation[] = [];

  for (const goal of analyzed) {
    const signals = signalMap.get(goal.id) ?? [];
    const blocked = state.actions.filter((action) => action.goalId === goal.id && action.status === "blocked");
    const missingNext = signals.includes(`goal:${goal.id}:missing-next-action`);
    if (blocked.length) recommendations.push({ id: `demo-blocked-${goal.id}`, title: `Odblokuj: ${goal.title}`, reason: `${blocked.length} ${blocked.length === 1 ? "Działanie jest zablokowane" : "Działania są zablokowane"}.`, suggestedNextStep: `Rozstrzygnij blokadę: ${blocked[0]?.blocker ?? "nazwij potrzebną decyzję"}.`, horizon: "now", confidence: "high", goalIds: [goal.id], actionIds: blocked.map((action) => action.id), signalKeys: signals.filter((signal) => signal.includes(":blocked:")) });
    else if (missingNext) recommendations.push({ id: `demo-next-${goal.id}`, title: `Ustal następny krok: ${goal.title}`, reason: "Cel nie ma oznaczonego następnego Działania.", suggestedNextStep: "Dodaj jeden konkretny krok możliwy do rozpoczęcia bez dodatkowego planowania.", horizon: "now", confidence: "high", goalIds: [goal.id], actionIds: [], signalKeys: [`goal:${goal.id}:missing-next-action`], draftAction: { goalId: goal.id, title: `Ustal następny krok dla: ${goal.title}`, detail: "Przygotowane przez AI — sprawdź treść przed zapisaniem." } });
    else if (signals.length) recommendations.push({ id: `demo-attention-${goal.id}`, title: `Sprawdź: ${goal.title}`, reason: "Deterministyczne sygnały wskazują, że plan wymaga aktualizacji.", suggestedNextStep: "Otwórz Cel i zweryfikuj termin, zakres oraz otwarte Działania.", horizon: "this_week", confidence: "medium", goalIds: [goal.id], actionIds: [], signalKeys: signals });
  }
  if (!recommendations.length) recommendations.push({ id: "demo-continue", title: "Utrzymaj obecny kierunek", reason: "Nie wykryto pilnych blokad ani brakujących następnych kroków.", suggestedNextStep: "Wybierz najważniejsze Działanie na początek tygodnia.", horizon: "this_week", confidence: "medium", goalIds: analyzed.slice(0, 1).map((goal) => goal.id), actionIds: [], signalKeys: [] });
  const visibleRecommendations = recommendations.slice(0, 5);
  const assessments = analyzed.map((goal) => {
    const signals = signalMap.get(goal.id) ?? [];
    const status = assessmentStatus(signals);
    return { goalId: goal.id, status, rationale: status === "on_track" ? "Cel ma dostępny następny krok i nie ma pilnych sygnałów." : status === "stuck" ? "Cel ma blokadę albo przekroczony termin." : "Cel wymaga doprecyzowania planu lub terminu.", nextStep: visibleRecommendations.find((item) => item.goalIds.includes(goal.id))?.suggestedNextStep ?? null, signalKeys: signals };
  });
  const overallStatus: AIGoalStatus = assessments.some((item) => item.status === "stuck") ? "stuck" : assessments.some((item) => item.status === "attention") ? "attention" : "on_track";
  const generatedAt = now.toISOString();

  return {
    reviewId: `demo-${day(now)}`,
    status: "ready",
    cached: false,
    generatedAt,
    periodStart: day(new Date(now.getTime() - 28 * 86_400_000)),
    periodEnd: day(now),
    provider: "demo",
    model: "deterministyczna symulacja",
    analyzedGoalIds: analyzed.map((goal) => goal.id),
    omittedGoalIds: omitted.map((goal) => goal.id),
    review: {
      schemaVersion: AI_GOAL_REVIEW_SCHEMA_VERSION,
      headline: overallStatus === "on_track" ? "Portfolio Celów ma czytelny kierunek" : "Kilka Celów wymaga świadomej decyzji",
      summary: `Przejrzano ${analyzed.length} aktywnych Celów. ${activeGoalsWithoutNextAction(state).length} nie ma następnego Działania; priorytetem są blokady i najbliższe konkretne ruchy.`,
      overallStatus,
      recommendations: visibleRecommendations,
      checks: assessments.filter((item) => item.status !== "on_track").slice(0, 5).map((item) => ({ id: `demo-check-${item.goalId}`, question: "Czy rezultat, termin i następny krok tego Celu są nadal aktualne?", whyItMatters: "Aktualna odpowiedź pozwoli odróżnić realną blokadę od nieaktualnego planu.", goalIds: [item.goalId], signalKeys: item.signalKeys })),
      goalAssessments: assessments
    }
  };
}
