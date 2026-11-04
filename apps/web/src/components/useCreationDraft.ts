import { useCallback, useMemo } from "react";
import { useStore } from "../app/useStore";
import { normalizeQuickAddMode } from "../domain/quickAdd";
import { categoryPresetSuggestion } from "../domain/projectPresets";
import { draftStorageKey, usePersistentDraft } from "../hooks/usePersistentDraft";
import { useAuth } from "../auth/useAuth";
import { emptyDraft, forkCreationDraft, isQuickAddDraft, migrateQuickAddDraft, type QuickAddDraft, type QuickAddRequest } from "./creationDraft";

export function creationScope(request?: QuickAddRequest) {
  const mode = normalizeQuickAddMode(request?.mode ?? "action");
  return `creation:${request?.actionId ? `action-${request.actionId}` : request?.sourceBookId ? `book-${request.sourceBookId}` : request?.materialKnowledgeIds?.length ? `materials-${[...request.materialKnowledgeIds].sort().join(",")}-${request.areaId ?? "global"}` : request?.goalId ? `goal-${request.goalId}` : request?.areaId ? `project-${request.areaId}` : request?.draftKey === "start" ? "start" : "global"}:${mode}`;
}

export function useCreationDraft(request?: QuickAddRequest, migrateLegacy = true) {
  const { state } = useStore();
  const { user, mode: authMode } = useAuth();
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const signature = JSON.stringify(request ?? {});
  const initial = useMemo<QuickAddDraft>(() => {
    const input = JSON.parse(signature) as QuickAddRequest;
    const projectCategoryIds = input.projectCategoryIds ?? [];
    return { ...emptyDraft, knowledgeIdempotencyKey: crypto.randomUUID(), mode: normalizeQuickAddMode(input.mode ?? "action"), context: input.goalId ? `goal:${input.goalId}` : input.areaId ? `area:${input.areaId}` : "", scheduledFor: input.scheduledFor ?? "", pinnedToToday: input.pinnedToToday ?? false, routineStartsOn: currentDate, routineWeekdays: [new Date(`${currentDate}T12:00:00Z`).getUTCDay()], projectCategoryIds, projectPreset: categoryPresetSuggestion(state.projectCategories ?? [], projectCategoryIds).preset, libraryKind: input.libraryKind ?? "note", isBook: input.isBook ?? false, readingStatus: input.readingStatus ?? "to_read", sourceBookId: input.sourceBookId, sourceBookTitle: input.sourceBookTitle, actionId: input.actionId, actionMeaning: input.actionId ? "material" : undefined, materialKnowledgeIds: input.materialKnowledgeIds, goalKind: input.goalKind ?? "custom" };
  }, [currentDate, signature, state.projectCategories]);
  const scope = creationScope(request);
  const mode = normalizeQuickAddMode(request?.mode ?? "action");
  const migrateFrom = useMemo(() => [
    { kind: request?.draftKey ? `quick-add:${request.draftKey}` : "global-quick-add", targetId: "new" },
    ...(!request?.draftKey ? [{ kind: "global-quick-add" }] : []),
    ...(request?.goalId && mode === "action" ? [{ kind: "goal-action", targetId: request.goalId }, { kind: `quick-add:goal-${request.goalId}`, targetId: "new" }] : []),
    ...(request?.draftKey === "start" ? [{ kind: "start-action", targetId: "new" }] : []),
    ...(mode === "routine" ? [{ kind: "routine-new", targetId: "new" }] : []),
    ...(mode === "library" ? request?.sourceBookId ? [{ kind: "book-knowledge-note", targetId: request.sourceBookId }] : request?.areaId ? [{ kind: "project-knowledge-note", targetId: request.areaId }] : [{ kind: "knowledge-create", targetId: "global" }] : [])
  ], [mode, request?.areaId, request?.draftKey, request?.goalId, request?.sourceBookId]);
  const migrate = useCallback((value: unknown) => migrateQuickAddDraft(value, initial), [initial]);
  const draft = usePersistentDraft(scope, initial, 250, { targetId: "new", validate: isQuickAddDraft, migrate, migrateFrom: migrateLegacy ? migrateFrom : [] });
  const fork = (nextRequest: QuickAddRequest, value: QuickAddDraft, expected?: string) => {
    const workspaceId = state.workspaceId ?? (authMode === "demo" ? "demo-workspace" : undefined);
    if (!user?.id || !workspaceId) return { error: "Nie ma aktywnej przestrzeni szkicu." };
    const key = draftStorageKey(user.id, workspaceId, creationScope(nextRequest), "new");
    try {
      const raw = localStorage.getItem(key);
      const existing = raw ? JSON.parse(raw).value as QuickAddDraft : undefined;
      if (existing?.receipt || localStorage.getItem(`${key}:receipt`)) return { error: "Ten typ ma potwierdzony zapis. Najpierw otwórz go i usuń zapisany szkic." };
      const candidate = forkCreationDraft(value, existing);
      if (existing && (existing.attempted || JSON.stringify(existing) !== expected && JSON.stringify(existing) !== JSON.stringify(candidate))) {
        const recovery = forkCreationDraft(value);
        localStorage.setItem(`${key}:recovery:${crypto.randomUUID()}`, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), value: recovery }));
        return { conflict: true, value: JSON.stringify(existing) };
      }
      localStorage.setItem(key, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), value: candidate }));
      return { value: JSON.stringify(candidate) };
    } catch { return { error: "Nie udało się zachować obu szkiców. Skopiuj treść albo ponów zapis szkicu przed zmianą typu." }; }
  };
  return { ...draft, initial, scope, currentDate, fork };
}
