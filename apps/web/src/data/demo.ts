import type { AppState } from "../domain/types";

export const demoState: AppState = {
  workspaceTimezone: "Europe/Warsaw",
  areas: [{ id: "area-finanse", name: "Finanse", description: "Budżet, rachunki i decyzje finansowe", color: "#60a5fa", visibility: "active", createdAt: "2026-07-01T08:00:00.000Z", updatedAt: "2026-07-01T08:00:00.000Z" }],
  goalTemplates: [],
  goals: [{ id: "goal-budget", title: "Zbudować spokojny budżet domowy", outcome: "Co miesiąc wiem, ile mogę bezpiecznie wydać i odłożyć", kind: "personal", status: "active", visibility: "active", priority: "normal", areaId: "area-finanse", createdAt: "2026-07-15T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }],
  goalCriteria: [{ id: "criterion-budget", goalId: "goal-budget", title: "Budżet obejmuje stałe koszty i oszczędności", completed: false }],
  actions: [
    { id: "action-budget-today", version: 1, goalId: "goal-budget", areaId: "area-finanse", title: "Spisać stałe koszty", detail: "Rachunki, subskrypcje i raty", status: "ready", position: 0, isNext: true, pinnedToToday: true, checklist: [], createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
    { id: "action-budget-overdue", version: 1, goalId: "goal-budget", areaId: "area-finanse", title: "Pobrać historię transakcji", detail: "Ostatnie trzy miesiące", status: "ready", position: 1, isNext: false, pinnedToToday: false, scheduledFor: "2026-08-01", checklist: [], createdAt: "2026-07-28T08:00:00.000Z", updatedAt: "2026-07-28T08:00:00.000Z" },
    { id: "action-budget-upcoming", version: 1, goalId: "goal-budget", areaId: "area-finanse", title: "Ustalić kwotę automatycznego przelewu", detail: "", status: "ready", position: 2, isNext: false, pinnedToToday: false, scheduledFor: "2026-08-10", checklist: [], createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }
  ],
  progressEntries: [{ id: "progress-budget-1", goalId: "goal-budget", kind: "decision", content: "Budżet prowadzę miesięcznie, bez dziennych limitów.", createdAt: "2026-08-01T18:00:00.000Z" }],
  recurringActionTemplates: [{ id: "series-budget", title: "Przegląd budżetu", detail: "Sprawdź wydatki i zaplanuj przelewy", goalId: "goal-budget", areaId: "area-finanse", timezone: "Europe/Warsaw", startsOn: "2026-08-04", rule: { unit: "week", interval: 1, weekdays: [2] }, missedPolicy: "skip_missed", status: "active", checklist: [{ title: "Sprawdź saldo" }, { title: "Zapisz jedną decyzję" }], skippedOccurrenceCount: 0, createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }],
  knowledgeLinks: [{ id: "link-budget-knowledge", knowledgeItemId: "know-3", goalId: "goal-budget", meaning: "material", createdAt: "2026-08-01T08:00:00.000Z" }],
  projects: [
    {
      id: "fintrack-api",
      name: "FinTrack API",
      initials: "FT",
      color: "violet",
      technology: "Node.js, TypeScript",
      outcome: "Niezawodne API do zarządzania finansami osobistymi",
      status: "W trakcie",
      commitmentStatus: "active",
      nextStep: "Zaprojektuj model danych transakcji",
      primary: true,
      effortBudgetMinutes: 540,
      usedMinutes: 235,
      requirements: [
        { id: "req-1", title: "Transakcja należy do jednego konta", status: "validated" },
        { id: "req-2", title: "Kategorie wspierają strukturę wielopoziomową", status: "accepted" },
        { id: "req-3", title: "Kwoty zachowują precyzję księgową", status: "accepted" }
      ],
      workItems: [
        { id: "wi-model", title: "Zaprojektuj encje i relacje dla transakcji", detail: "Utwórz diagram ERD i zdefiniuj kluczowe pola.", completed: false },
        { id: "wi-erd", title: "Zweryfikuj diagram ERD", detail: "Sprawdź normalizację i ograniczenia integralności.", completed: false },
        { id: "wi-migration", title: "Przygotuj migrację", detail: "Dodaj tabele i polityki dostępu.", completed: false }
      ]
    },
    {
      id: "portfolio-v2",
      name: "Portfolio v2",
      initials: "PA",
      color: "orange",
      technology: "Next.js, Tailwind",
      outcome: "Nowa wersja portfolio z case studies i blogiem",
      status: "Zagrożony",
      commitmentStatus: "active",
      nextStep: "Dokończ sekcję case studies",
      blocker: "Brakujące treści od designu",
      primary: false,
      effortBudgetMinutes: 360,
      usedMinutes: 188,
      requirements: [
        { id: "req-p1", title: "Dwa kompletne case studies", status: "accepted" },
        { id: "req-p2", title: "Wynik Lighthouse powyżej 90", status: "proposed" }
      ],
      workItems: [
        { id: "wi-cases", title: "Dokończ sekcję case studies", detail: "Uzupełnij rezultaty i obrazy projektu FinTrack.", completed: false }
      ]
    },
    {
      id: "learnbridge",
      name: "LearnBridge",
      initials: "LB",
      color: "amber",
      technology: "React Native, Expo",
      outcome: "Aplikacja do nauki z powtórkami opartymi na dowodach",
      status: "Gotowy do decyzji",
      commitmentStatus: "active",
      nextStep: "Zdecyduj o MVP i kluczowych funkcjach",
      blocker: "Decyzja produktowa w toku",
      primary: false,
      usedMinutes: 72,
      requirements: [
        { id: "req-l1", title: "Powtórki wynikają z luk w dowodach", status: "proposed" }
      ],
      workItems: [
        { id: "wi-mvp", title: "Zdecyduj o zakresie MVP", detail: "Wybierz jedną pętlę nauki do walidacji.", completed: false }
      ]
    }
  ],
  checkpoints: [
    {
      id: "cp-1",
      projectId: "fintrack-api",
      title: "ERD: Transactions — wersja robocza",
      currentState: "Wybrana struktura wiele-do-wielu dla kategorii; relacja konta jest gotowa.",
      nextAction: "Zaimplementuj repozytoria dla Transactions",
      branch: "feat/transactions-model",
      file: "src/db/schema.ts",
      createdAt: "2026-08-01T07:10:00.000Z"
    },
    {
      id: "cp-2",
      projectId: "portfolio-v2",
      title: "Case study — komponent gotowy do treści",
      currentState: "Layout działa na desktopie; mobile wymaga korekty obrazów.",
      nextAction: "Dokończ komponent CaseStudy",
      branch: "main",
      file: "components/CaseStudy.tsx",
      createdAt: "2026-07-31T14:45:00.000Z"
    },
    {
      id: "cp-3",
      projectId: "learnbridge",
      title: "Aktualizacja zależności",
      currentState: "Expo uruchamia się po aktualizacji, testy przechodzą.",
      nextAction: "Zweryfikuj zależności i build",
      branch: "chore/update-deps",
      file: "package.json",
      createdAt: "2026-07-30T12:15:00.000Z"
    }
  ],
  inbox: [
    { id: "in-1", kind: "text", content: "Sprawdzić wydajność zapytań w endpointzie /transactions", createdAt: "2026-08-01T07:42:00.000Z", status: "unprocessed" },
    { id: "in-2", kind: "link", content: "https://www.postgresql.org/docs/current/erd.html", createdAt: "2026-08-01T07:15:00.000Z", status: "unprocessed" },
    { id: "in-3", kind: "file", content: "Diagram ERD — szkic v1", createdAt: "2026-08-01T06:58:00.000Z", status: "unprocessed" }
  ],
  evidence: [
    { id: "ev-1", learningGoalId: "goal-ts-modeling", title: "Ukończone ćwiczenie", detail: "Modelowanie relacji 1:N i N:M", result: "supports", assessmentMethod: "self_review", accepted: true, createdAt: "2026-07-31T12:00:00.000Z" },
    { id: "ev-2", learningGoalId: "goal-ts-modeling", title: "Przejrzany artefakt", detail: "Diagram ERD — Transactions v1", result: "supports", assessmentMethod: "human_feedback", accepted: true, createdAt: "2026-07-30T15:00:00.000Z" },
    { id: "ev-3", learningGoalId: "goal-ts-modeling", title: "Zidentyfikowana luka wiedzy", detail: "Optymalizacja zapytań SQL: JOIN i INDEX", result: "reveals_gap", assessmentMethod: "self_review", accepted: true, createdAt: "2026-07-29T09:00:00.000Z" }
  ],
  learningGoals: [{ id: "goal-ts-modeling", title: "Projektuj skalowalne modele danych", criterion: "Zaprojektuj i obroń model dla realnego systemu", status: "shaped", skills: ["TypeScript Architecture", "PostgreSQL"] }],
  knowledge: [
    { id: "know-1", type: "artifact", title: "Diagram ERD — Transactions v1", detail: "FinTrack API • zaktualizowano wczoraj" },
    { id: "know-2", type: "decision", title: "Typ danych dla kwot pieniężnych", detail: "DECIMAL(18,2) zamiast float • 2 źródła" },
    { id: "know-3", type: "resource", title: "PostgreSQL: constraints and normalization", detail: "Dokumentacja źródłowa • użyte w 2 projektach" },
    { id: "know-4", type: "note", title: "Wzorce modelowania transakcji", detail: "Notatka robocza • 4 powiązania" }
  ],
  reviews: [],
  aiProposals: [{ id: "ai-proposal-demo", command: "triage_inbox", preview: "Dodaj pierwszy Inbox Item do Primary Project jako Work Item", sources: ["in-1"], risk: "low", expectedVersions: {}, expiresAt: "2099-08-02T12:00:00.000Z", status: "pending" }],
  aiExecutions: [],
  focusSessions: [],
  focus: {
    running: false,
    elapsedBeforeStart: 0,
    projectId: "fintrack-api",
    workItemId: "wi-model",
    scratchpad: "Encje: User, Account, Transaction, Category.\nRelacje: User (1) — (N) Account, Account (1) — (N) Transaction."
  },
  aiProposal: "pending"
};
