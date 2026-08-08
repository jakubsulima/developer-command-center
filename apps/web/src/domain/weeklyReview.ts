import type { AppState } from "./types";

export interface WeeklyReviewSuggestion {
  id: string;
  title: string;
  detail: string;
  to: string;
}

export interface WeeklyReviewSummary {
  start: Date;
  end: Date;
  completedActions: number;
  focusMinutes: number;
  knowledgeAdded: number;
  progressUpdates: number;
  generatedSummary: string;
  suggestions: WeeklyReviewSuggestion[];
}

const within = (value: string | undefined, start: Date, end: Date) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= start.getTime() && timestamp < end.getTime();
};

const counted = (count: number, one: string, few: string, many: string) => {
  if (count === 1) return one;
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
};

export function weekBounds(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function deriveWeeklyReview(state: AppState, now = new Date()): WeeklyReviewSummary {
  const { start, end } = weekBounds(now);
  const completedActions = state.actions.filter((action) => action.status === "completed" && within(action.completedAt ?? action.updatedAt, start, end)).length;
  const knowledgeAdded = state.knowledge.filter((item) => within(item.createdAt, start, end)).length;
  const progressUpdates = state.progressEntries.filter((entry) => within(entry.createdAt, start, end)).length;
  const focusMinutes = Math.round(state.focusSessions.reduce((total, session) => {
    if (!session.endedAt || !within(session.endedAt, start, end)) return total;
    return total + Math.max(0, new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000;
  }, 0));

  const activeGoals = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active");
  const goalsWithoutNextAction = activeGoals.filter((goal) => !state.actions.some((action) => action.goalId === goal.id && action.isNext && ["ready", "in_progress"].includes(action.status)));
  const blockedActions = state.actions.filter((action) => action.status === "blocked");
  const activeProjects = state.projects.filter((project) => project.commitmentStatus === "active");
  const unprocessedInbox = state.inbox.filter((item) => item.status === "unprocessed");
  const today = now.toISOString().slice(0, 10);
  const overdueActions = state.actions.filter((action) => action.scheduledFor && action.scheduledFor < today && ["ready", "in_progress", "blocked"].includes(action.status));

  const suggestions: WeeklyReviewSuggestion[] = [];
  if (blockedActions.length) suggestions.push({
    id: "blocked",
    title: `Odblokuj ${blockedActions.length === 1 ? "jedno Działanie" : `${blockedActions.length} ${counted(blockedActions.length, "Działanie", "Działania", "Działań")}`}`,
    detail: "Najpierw podejmij decyzję albo nazwij osobę, od której zależy dalszy ruch.",
    to: "/"
  });
  if (goalsWithoutNextAction.length) suggestions.push({
    id: "next-actions",
    title: `Ustal następny krok dla ${goalsWithoutNextAction.length === 1 ? "jednego Celu" : `${goalsWithoutNextAction.length} Celów`}`,
    detail: "Cel bez konkretnego następnego Działania będzie trudny do wznowienia.",
    to: `/goals/${goalsWithoutNextAction[0]!.id}`
  });
  if (overdueActions.length) suggestions.push({
    id: "overdue",
    title: `Zdecyduj o ${overdueActions.length === 1 ? "jednym zaległym Działaniu" : `${overdueActions.length} zaległych Działaniach`}`,
    detail: "Przełóż, ukończ lub anuluj je, zamiast przenosić cały ciężar na kolejny tydzień.",
    to: "/"
  });
  if (activeProjects.length > 3) suggestions.push({
    id: "wip",
    title: "Ogranicz liczbę aktywnych Projektów",
    detail: `Masz ${activeProjects.length} aktywnych zobowiązań. Zostaw najwyżej trzy najważniejsze.`,
    to: "/projects"
  });
  if (unprocessedInbox.length) suggestions.push({
    id: "inbox",
    title: `Przejrzyj ${unprocessedInbox.length} ${counted(unprocessedInbox.length, "element Inboxu", "elementy Inboxu", "elementów Inboxu")}`,
    detail: "Zacznij od tych, które mogą zmienić plan lub blokują następny krok.",
    to: "/inbox"
  });
  if (!suggestions.length) suggestions.push({
    id: "continue",
    title: "Utrzymaj obecny kierunek",
    detail: "Nie widać pilnych wyjątków. Wybierz jedno najważniejsze Działanie na początek tygodnia.",
    to: "/"
  });

  const delivery = completedActions
    ? `Ukończono ${completedActions} ${counted(completedActions, "Działanie", "Działania", "Działań")}`
    : "Nie odnotowano ukończonych Działań";
  const context = knowledgeAdded || progressUpdates
    ? `Dodano ${knowledgeAdded} ${counted(knowledgeAdded, "element Wiedzy", "elementy Wiedzy", "elementów Wiedzy")} i ${progressUpdates} ${counted(progressUpdates, "aktualizację postępu", "aktualizacje postępu", "aktualizacji postępu")}.`
    : "Nie dodano nowej Wiedzy ani aktualizacji postępu.";
  const attention = blockedActions.length || goalsWithoutNextAction.length || unprocessedInbox.length
    ? `Na decyzję czeka ${blockedActions.length} ${counted(blockedActions.length, "blokada", "blokady", "blokad")}, ${goalsWithoutNextAction.length} ${counted(goalsWithoutNextAction.length, "Cel", "Cele", "Celów")} bez następnego kroku i ${unprocessedInbox.length} ${counted(unprocessedInbox.length, "element Inboxu", "elementy Inboxu", "elementów Inboxu")}.`
    : "Nie ma pilnych sygnałów wymagających decyzji.";

  return {
    start,
    end,
    completedActions,
    focusMinutes,
    knowledgeAdded,
    progressUpdates,
    generatedSummary: `${delivery}. ${context} ${attention}`,
    suggestions: suggestions.slice(0, 3)
  };
}
