import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { executeDomainCommand } from "./commands";

describe("komendy domenowe Workspace", () => {
  it("pozwala przekroczyć limit WIP wyłącznie ze świadomym uzasadnieniem", () => {
    const atLimit = {
      ...structuredClone(emptyState),
      projects: ["one", "two", "three"].map((id, index) => ({
        id,
        name: `Projekt ${index + 1}`,
        initials: `P${index + 1}`,
        color: "violet" as const,
        technology: "TypeScript",
        outcome: "Obserwowalny rezultat",
        status: "W trakcie" as const,
        domainStatus: "shaped" as const,
        commitmentStatus: "active" as const,
        nextStep: "Następny krok",
        primary: index === 0,
        usedMinutes: 0,
        requirements: [],
        workItems: []
      }))
    };

    expect(() => executeDomainCommand(atLimit, {
      type: "create_project",
      id: "four",
      title: "Projekt 4",
      outcome: "Czwarty rezultat",
      technology: "React",
      firstWorkItem: { id: "work-four", title: "Zbuduj przepływ", detail: "" }
    })).toThrow("wip_override_reason_required");

    const next = executeDomainCommand(atLimit, {
      type: "create_project",
      id: "four",
      title: "Projekt 4",
      outcome: "Czwarty rezultat",
      technology: "React",
      firstWorkItem: { id: "work-four", title: "Zbuduj przepływ", detail: "" },
      wipOverrideReason: "Incydent produkcyjny wymaga natychmiastowej pracy"
    });

    expect(next.projects).toHaveLength(4);
    expect(next.projects[3]).toMatchObject({
      id: "four",
      commitmentStatus: "active",
      commitmentOverrideReason: "Incydent produkcyjny wymaga natychmiastowej pracy"
    });
  });

  it("wstrzymuje Commitment i wybiera nowe Primary spośród aktywnych", () => {
    const state = executeDomainCommand(executeDomainCommand(structuredClone(emptyState), {
      type: "create_project",
      id: "one",
      title: "Projekt 1",
      outcome: "Pierwszy rezultat",
      technology: "React",
      firstWorkItem: { id: "work-one", title: "Krok 1", detail: "" }
    }), {
      type: "create_project",
      id: "two",
      title: "Projekt 2",
      outcome: "Drugi rezultat",
      technology: "TypeScript",
      firstWorkItem: { id: "work-two", title: "Krok 2", detail: "" }
    });

    const next = executeDomainCommand(state, { type: "set_commitment_status", projectId: "one", status: "paused" });

    expect(next.projects.find((project) => project.id === "one")).toMatchObject({ commitmentStatus: "paused", primary: false });
    expect(next.projects.find((project) => project.id === "two")).toMatchObject({ commitmentStatus: "active", primary: true });

    const restored = executeDomainCommand(next, { type: "set_primary_commitment", projectId: "one" });
    expect(restored.projects.find((project) => project.id === "one")?.primary).toBe(false);
  });

  it("prowadzi Work Item przez blokadę i ukończenie bez udawania stanu Focus", () => {
    const state = executeDomainCommand(structuredClone(emptyState), {
      type: "create_project",
      id: "project",
      title: "Projekt",
      outcome: "Rezultat",
      technology: "React",
      firstWorkItem: { id: "work", title: "Usuń błąd", detail: "Odtwórz problem" }
    });

    const blocked = executeDomainCommand(state, {
      type: "set_work_item_status",
      projectId: "project",
      workItemId: "work",
      status: "blocked",
      blocker: "Brak danych testowych"
    });
    expect(blocked.projects[0]?.workItems[0]).toMatchObject({ status: "blocked", completed: false, blocker: "Brak danych testowych" });
    expect(blocked.projects[0]).toMatchObject({ status: "Zagrożony", blocker: "Brak danych testowych" });

    const completed = executeDomainCommand(blocked, {
      type: "set_work_item_status",
      projectId: "project",
      workItemId: "work",
      status: "completed"
    });
    expect(completed.projects[0]?.workItems[0]).toMatchObject({ status: "completed", completed: true, blocker: undefined });
    expect(completed.projects[0]?.blocker).toBeUndefined();
  });

  it("kończy ciągłą Focus Session checkpointem, a wznowienie tworzy nowy rekord", () => {
    const project = executeDomainCommand(structuredClone(emptyState), {
      type: "create_project",
      id: "project",
      title: "Projekt",
      outcome: "Rezultat",
      technology: "React",
      firstWorkItem: { id: "work", title: "Zbuduj komponent", detail: "" }
    });
    const running = executeDomainCommand(project, {
      type: "start_focus",
      sessionId: "session-one",
      projectId: "project",
      workItemId: "work",
      startedAt: "2026-08-01T10:00:00.000Z"
    });
    const paused = executeDomainCommand(running, {
      type: "end_focus",
      sessionId: "session-one",
      checkpointId: "checkpoint-one",
      reason: "paused",
      currentState: "Komponent renderuje dane",
      nextAction: "Dodać obsługę błędu",
      endedAt: "2026-08-01T10:25:00.000Z"
    });

    expect(paused.focusSessions[0]).toMatchObject({ id: "session-one", endReason: "paused", endedAt: "2026-08-01T10:25:00.000Z" });
    expect(paused.checkpoints).toHaveLength(1);
    expect(paused.projects[0]?.usedMinutes).toBe(25);

    const resumed = executeDomainCommand(paused, {
      type: "start_focus",
      sessionId: "session-two",
      projectId: "project",
      workItemId: "work",
      startedAt: "2026-08-01T11:00:00.000Z"
    });
    expect(resumed.focusSessions.map((session) => session.id)).toEqual(["session-one", "session-two"]);
    expect(resumed.checkpoints[0]?.lockedAt).toBe("2026-08-01T11:00:00.000Z");
    expect(resumed.focus).toMatchObject({ running: true, sessionId: "session-two", elapsedBeforeStart: 0 });
  });

  it("triage zachowuje oryginalny Inbox Item i tworzy typowany obiekt z pochodzeniem", () => {
    const state = {
      ...structuredClone(emptyState),
      inbox: [{ id: "inbox-one", kind: "link" as const, content: "https://example.com/sql", createdAt: "2026-08-01T09:00:00.000Z", status: "unprocessed" as const }]
    };

    const next = executeDomainCommand(state, {
      type: "triage_inbox",
      inboxItemId: "inbox-one",
      target: "resource",
      targetId: "resource-one",
      title: "SQL performance guide",
      detail: "Źródło do optymalizacji zapytań",
      decidedAt: "2026-08-01T09:05:00.000Z"
    });

    expect(next.inbox[0]).toMatchObject({ id: "inbox-one", status: "resolved", resolvedToIds: ["resource-one"] });
    expect(next.knowledge[0]).toMatchObject({ id: "resource-one", type: "resource", sourceInboxItemId: "inbox-one", title: "SQL performance guide" });
  });

  it("pozwala poprawić checkpoint tylko do rozpoczęcia kolejnej sesji", () => {
    const editable = {
      ...structuredClone(emptyState),
      checkpoints: [{
        id: "checkpoint-one", projectId: "project", workItemId: "work", sessionId: "session-one",
        title: "Checkpoint", currentState: "Stary stan", nextAction: "Stary krok",
        createdAt: "2026-08-01T10:00:00.000Z"
      }]
    };

    const updated = executeDomainCommand(editable, {
      type: "update_checkpoint",
      checkpointId: "checkpoint-one",
      currentState: "Testy przechodzą",
      nextAction: "Dodać obsługę błędu",
      updatedAt: "2026-08-01T10:05:00.000Z"
    });
    expect(updated.checkpoints[0]).toMatchObject({ currentState: "Testy przechodzą", nextAction: "Dodać obsługę błędu" });

    updated.checkpoints[0]!.lockedAt = "2026-08-01T11:00:00.000Z";
    expect(() => executeDomainCommand(updated, {
      type: "update_checkpoint",
      checkpointId: "checkpoint-one",
      currentState: "Zmiana po wznowieniu",
      nextAction: "Nie powinna wejść",
      updatedAt: "2026-08-01T11:05:00.000Z"
    })).toThrow("checkpoint_locked");
  });

  it("promuje kopię scratchpadu do Note bez zmiany oryginału sesji", () => {
    const state = {
      ...structuredClone(emptyState),
      focusSessions: [{ id: "session-one", projectId: "project", workItemId: "work", startedAt: "2026-08-01T10:00:00.000Z", scratchpad: "Hipoteza: indeks złożony" }]
    };
    const next = executeDomainCommand(state, {
      type: "promote_scratchpad",
      sessionId: "session-one",
      target: "note",
      targetId: "note-one",
      title: "Hipoteza wydajności",
      content: "indeks złożony",
      createdAt: "2026-08-01T10:10:00.000Z"
    });

    expect(next.focusSessions[0]?.scratchpad).toBe("Hipoteza: indeks złożony");
    expect(next.knowledge[0]).toMatchObject({ id: "note-one", type: "note", detail: "indeks złożony", sourceSessionId: "session-one" });
  });

  it("dołącza materiał do decyzji jako jej potwierdzenie", () => {
    const state = {
      ...structuredClone(emptyState),
      knowledge: [
        { id: "decision", type: "decision" as const, title: "Wybieramy PostgreSQL", detail: "" },
        { id: "source", type: "resource" as const, title: "Porównanie baz", detail: "" }
      ]
    };
    const next = executeDomainCommand(state, {
      type: "link_knowledge",
      id: "support-link",
      knowledgeItemId: "source",
      targetKnowledgeItemId: "decision",
      meaning: "material",
      createdAt: "2026-08-20T12:00:00.000Z"
    });

    expect(next.knowledgeLinks).toEqual([expect.objectContaining({
      knowledgeItemId: "source",
      targetKnowledgeItemId: "decision",
      meaning: "material"
    })]);
    expect(() => executeDomainCommand(state, {
      type: "link_knowledge",
      id: "self-link",
      knowledgeItemId: "decision",
      targetKnowledgeItemId: "decision",
      meaning: "material",
      createdAt: "2026-08-20T12:00:00.000Z"
    })).toThrow("knowledge_self_link_not_allowed");
  });

  it("archiwizuje, przenosi do Trash i przywraca bez zmiany stanu domenowego", () => {
    const state = executeDomainCommand(structuredClone(emptyState), {
      type: "create_project", id: "project", title: "Projekt", outcome: "Rezultat", technology: "React",
      firstWorkItem: { id: "work", title: "Krok", detail: "" }
    });
    const archived = executeDomainCommand(state, { type: "set_visibility", entityType: "project", entityId: "project", visibility: "archived", changedAt: "2026-08-01T12:00:00.000Z" });
    expect(archived.projects[0]).toMatchObject({ domainStatus: "shaped", archivedAt: "2026-08-01T12:00:00.000Z" });

    const trashed = executeDomainCommand(archived, { type: "set_visibility", entityType: "project", entityId: "project", visibility: "trashed", changedAt: "2026-08-01T12:05:00.000Z" });
    expect(trashed.projects[0]).toMatchObject({ domainStatus: "shaped", trashedAt: "2026-08-01T12:05:00.000Z" });

    const restored = executeDomainCommand(trashed, { type: "set_visibility", entityType: "project", entityId: "project", visibility: "active", changedAt: "2026-08-01T12:10:00.000Z" });
    expect(restored.projects[0]).toMatchObject({ domainStatus: "shaped", archivedAt: undefined, trashedAt: undefined });
  });

  it("osiąga Learning Goal dopiero na podstawie zaakceptowanego dowodu wspierającego", () => {
    const state = {
      ...structuredClone(emptyState),
      learningGoals: [{ id: "goal", title: "Projektuj RLS", criterion: "Wykaż izolację Workspace", status: "shaped" as const, skills: ["PostgreSQL"] }],
      evidence: [{ id: "evidence", learningGoalId: "goal", title: "Test RLS", detail: "Dwa odizolowane Workspace", result: "supports" as const, assessmentMethod: "automated_test" as const, accepted: true, createdAt: "2026-08-01T12:00:00.000Z" }]
    };

    const achieved = executeDomainCommand(state, { type: "set_learning_goal_status", goalId: "goal", status: "achieved" });
    expect(achieved.learningGoals[0]).toMatchObject({ status: "achieved" });

    const withoutAcceptedEvidence = { ...state, evidence: state.evidence.map((item) => ({ ...item, accepted: false })) };
    expect(() => executeDomainCommand(withoutAcceptedEvidence, { type: "set_learning_goal_status", goalId: "goal", status: "achieved" })).toThrow("accepted_supporting_evidence_required");
  });

  it("zapisuje każdy ukończony daily lub weekly Review jako osobny niezmienny rekord", () => {
    const daily = executeDomainCommand(structuredClone(emptyState), {
      type: "complete_review", reviewId: "daily-one", reviewType: "daily", templateVersion: 1,
      answers: { focus: "Kontynuuj główny Work Item" }, summary: "Bez zmiany kierunku", completedAt: "2026-08-01T18:00:00.000Z"
    });
    const weekly = executeDomainCommand(daily, {
      type: "complete_review", reviewId: "weekly-one", reviewType: "weekly", templateVersion: 1,
      answers: { wip: "Zwolnij jeden Commitment" }, summary: "Ograniczam WIP", completedAt: "2026-08-02T18:00:00.000Z"
    });

    expect(weekly.reviews).toHaveLength(2);
    expect(weekly.reviews.map((review) => review.type)).toEqual(["daily", "weekly"]);
    expect(weekly.reviewCompletedAt).toBe("2026-08-02T18:00:00.000Z");
  });

  it("oddziela akceptację AI Proposal od wykonania komendy", () => {
    const state = {
      ...structuredClone(emptyState),
      aiProposals: [{ id: "proposal", command: "triage_inbox", preview: "Utwórz Resource", sources: ["inbox-one"], risk: "low" as const, expectedVersions: {}, expiresAt: "2026-08-02T12:00:00.000Z", status: "pending" as const }]
    };
    const approved = executeDomainCommand(state, { type: "decide_ai_proposal", proposalId: "proposal", decision: "approved", executionId: "execution", decidedAt: "2026-08-01T12:00:00.000Z" });

    expect(approved.aiProposals[0]?.status).toBe("approved");
    expect(approved.aiExecutions[0]).toMatchObject({ id: "execution", proposalId: "proposal", status: "queued" });
    expect(approved.aiProposal).toBe("approved");
  });

  it("odkłada i odrzuca Inbox Item bez utraty surowej treści", () => {
    const state = { ...structuredClone(emptyState), inbox: [{ id: "inbox", kind: "text" as const, content: "Surowa myśl", createdAt: "2026-08-01T12:00:00.000Z", status: "unprocessed" as const }] };
    const snoozed = executeDomainCommand(state, { type: "set_inbox_status", inboxItemId: "inbox", status: "snoozed", changedAt: "2026-08-01T12:05:00.000Z", snoozedUntil: "2026-08-02T08:00:00.000Z" });
    expect(snoozed.inbox[0]).toMatchObject({ content: "Surowa myśl", status: "snoozed", snoozedUntil: "2026-08-02T08:00:00.000Z" });
    const discarded = executeDomainCommand(snoozed, { type: "set_inbox_status", inboxItemId: "inbox", status: "discarded", changedAt: "2026-08-01T12:10:00.000Z" });
    expect(discarded.inbox[0]).toMatchObject({ content: "Surowa myśl", status: "discarded", discardedAt: "2026-08-01T12:10:00.000Z" });
  });

  it("tworzy ograniczone Investigation z pytaniem zamiast zwykłej notatki", () => {
    const next = executeDomainCommand(structuredClone(emptyState), {
      type: "create_knowledge", id: "investigation", kind: "investigation", title: "Czy indeks poprawi endpoint?",
      detail: "Porównaj EXPLAIN ANALYZE przed i po", createdAt: "2026-08-01T12:00:00.000Z"
    });
    expect(next.knowledge[0]).toMatchObject({ id: "investigation", type: "investigation", status: "shaped", question: "Czy indeks poprawi endpoint?" });
  });

  it("wykonuje zatwierdzoną AI Proposal jako osobny, audytowalny krok", () => {
    const state = {
      ...structuredClone(emptyState),
      aiProposals: [{ id: "proposal", command: "triage_inbox", preview: "Utwórz Resource", sources: ["inbox"], risk: "low" as const, expectedVersions: {}, expiresAt: "2026-08-02T12:00:00.000Z", status: "approved" as const }],
      aiExecutions: [{ id: "execution", proposalId: "proposal", status: "queued" as const, createdAt: "2026-08-01T12:00:00.000Z" }]
    };
    const running = executeDomainCommand(state, { type: "set_ai_execution_status", executionId: "execution", status: "running", changedAt: "2026-08-01T12:01:00.000Z" });
    const succeeded = executeDomainCommand(running, { type: "set_ai_execution_status", executionId: "execution", status: "succeeded", changedAt: "2026-08-01T12:02:00.000Z" });
    expect(succeeded.aiExecutions[0]).toMatchObject({ status: "succeeded", completedAt: "2026-08-01T12:02:00.000Z" });
  });

  it("egzekwuje typowane role relacji i pojedynczy cel", () => {
    const state = {
      ...structuredClone(emptyState),
      knowledge: [{ id: "note", type: "note" as const, title: "Notatka", detail: "" }, { id: "decision", type: "decision" as const, title: "Decyzja", detail: "" }]
    };
    expect(() => executeDomainCommand(state, { type: "link_knowledge", id: "bad-result", knowledgeItemId: "note", actionId: "action", meaning: "result", createdAt: "now" })).toThrow("knowledge_result_requires_artifact");
    expect(() => executeDomainCommand(state, { type: "link_knowledge", id: "bad-target", knowledgeItemId: "note", actionId: "action", goalId: "goal", meaning: "material", createdAt: "now" })).toThrow("knowledge_link_target_required");
    expect(() => executeDomainCommand(state, { type: "link_knowledge", id: "bad-decision", knowledgeItemId: "note", targetKnowledgeItemId: "decision", meaning: "decision", createdAt: "now" })).toThrow("knowledge_decision_requires_decision");
  });

  it("tworzy rezultat, relację i historię Celu atomowo oraz jest idempotentne", () => {
    const state = {
      ...structuredClone(emptyState),
      goals: [{ id: "goal", title: "Cel", outcome: "Wynik", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const }],
      actions: [{ id: "action", version: 1, title: "Wykonać krok", detail: "", goalId: "goal", status: "completed" as const, position: 0, isNext: false, pinnedToToday: false, checklist: [] }]
    };
    const command = { type: "record_action_result" as const, actionId: "action", result: { kind: "new" as const, title: "Gotowy wynik", detail: "Opis wyniku" }, knowledgeId: "artifact", linkId: "result-link", progressId: "progress-result", createdAt: "now" };
    const next = executeDomainCommand(state, command);
    expect(next.knowledge[0]).toMatchObject({ id: "artifact", type: "artifact", title: "Gotowy wynik" });
    expect(next.knowledgeLinks).toEqual([expect.objectContaining({ knowledgeItemId: "artifact", actionId: "action", meaning: "result" })]);
    expect(next.progressEntries[0]).toMatchObject({ goalId: "goal", actionId: "action", knowledgeItemId: "artifact", kind: "result" });
    const retried = executeDomainCommand(next, command);
    expect(retried.knowledge).toHaveLength(1);
    expect(retried.knowledgeLinks).toHaveLength(1);
    expect(retried.progressEntries).toHaveLength(1);
  });
});
