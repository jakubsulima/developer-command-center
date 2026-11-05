import { quickAddModes, splitQuickAddContent, type QuickAddMode } from "../domain/quickAdd";
import type { GoalKind, ProjectPreset, ReadingStatus } from "../domain/types";
import type { CreatableKnowledgeKind } from "../domain/knowledge-kinds";
export type QuickAddRequest = {
  mode?: QuickAddMode;
  goalId?: string;
  areaId?: string;
  scheduledFor?: string;
  pinnedToToday?: boolean;
  materialKnowledgeIds?: string[];
  projectCategoryIds?: string[];
  libraryKind?: CreatableKnowledgeKind;
  isBook?: boolean;
  readingStatus?: ReadingStatus;
  actionId?: string;
  sourceBookId?: string;
  sourceBookTitle?: string;
  goalKind?: GoalKind;
  /** Distinguishes drafts belonging to contextual entry points. */
  draftKey?: string;
};

export type CreationReceipt = { id: string; url: string; message: string; pendingOccurrences?: boolean };
export type QuickAddDraft = { schemaVersion?: 2 | 3; attempted?: boolean; goalKind?: GoalKind; goalTemplateId?: string; goalCriteria?: string; firstActionTitle?: string; isBook?: boolean; resourceAuthor?: string; readingStatus?: ReadingStatus; sourceBookId?: string; sourceBookTitle?: string; actionId?: string; actionMeaning?: "material" | "reference" | "decision"; routineEndsOn?: string; routineChecklist?: string; routineMissedPolicy?: "skip_missed" | "carry_one"; receipt?: CreationReceipt; materialKnowledgeIds?: string[]; projectCategoryIds?: string[]; projectPreset?: ProjectPreset; projectPresetManuallyChosen?: boolean; mode: QuickAddMode; content: string; title: string; detail: string; context: string; scheduledFor: string; pinnedToToday: boolean; libraryKind: CreatableKnowledgeKind; sourceUrl: string; goalIds: string[]; routineUnit: "day" | "week" | "month"; routineInterval: string; routineStartsOn: string; routineWeekdays: number[]; knowledgeIdempotencyKey: string; contexts?: Partial<Record<QuickAddMode, string>> };
export const emptyDraft: QuickAddDraft = { schemaVersion: 3, mode: "action", content: "", title: "", detail: "", context: "", scheduledFor: "", pinnedToToday: false, libraryKind: "note", sourceUrl: "", goalIds: [], routineUnit: "week", routineInterval: "1", routineStartsOn: "", routineWeekdays: [], knowledgeIdempotencyKey: "", projectPreset: "standard", projectPresetManuallyChosen: false };
export const isQuickAddDraft = (value: unknown): value is QuickAddDraft => {
  if (!value || typeof value !== "object") return false;
  const draft = value as QuickAddDraft;
  return draft.schemaVersion === 3 && [draft.content, draft.title, draft.detail, draft.context, draft.scheduledFor, draft.sourceUrl, draft.routineInterval, draft.routineStartsOn].every((field) => typeof field === "string")
    && typeof draft.pinnedToToday === "boolean"
    && (quickAddModes as readonly string[]).includes(draft.mode)
    && ["note", "resource", "decision"].includes(draft.libraryKind)
    && ["day", "week", "month"].includes(draft.routineUnit)
    && (draft.projectCategoryIds === undefined || (Array.isArray(draft.projectCategoryIds) && draft.projectCategoryIds.every((id) => typeof id === "string")))
    && (draft.projectPreset === undefined || ["standard", "reading"].includes(draft.projectPreset))
    && (draft.projectPresetManuallyChosen === undefined || typeof draft.projectPresetManuallyChosen === "boolean")
    && Array.isArray(draft.goalIds) && draft.goalIds.every((id) => typeof id === "string")
    && Array.isArray(draft.routineWeekdays) && draft.routineWeekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && typeof draft.knowledgeIdempotencyKey === "string"
    && (draft.contexts === undefined || Boolean(draft.contexts && typeof draft.contexts === "object" && Object.entries(draft.contexts).every(([mode, context]) => (quickAddModes as readonly string[]).includes(mode) && typeof context === "string")));
};
export function migrateQuickAddDraft(value: unknown, initialDraft: QuickAddDraft): QuickAddDraft | undefined {
  if (typeof value === "string") return { ...initialDraft, content: value, mode: "inbox" };
  if (!value || typeof value !== "object") return undefined;
  const legacy = value as Partial<QuickAddDraft> & { content?: string; name?: string; description?: string; areaId?: string; projectId?: string; goalId?: string; kind?: CreatableKnowledgeKind; idempotencyKey?: string; sourceBookId?: string };
  if (typeof legacy.name === "string") return { ...initialDraft, title: legacy.name, detail: legacy.description ?? "", projectCategoryIds: legacy.projectCategoryIds ?? [] };
  if (typeof legacy.content !== "string" && typeof legacy.title !== "string") return undefined;
  const mode = legacy.mode === "knowledge" ? "inbox" : (quickAddModes as readonly unknown[]).includes(legacy.mode) ? legacy.mode! : initialDraft.mode;
  const content = typeof legacy.content === "string" ? legacy.content : legacy.title!;
  const split = splitQuickAddContent(content);
  const migrated = { ...initialDraft, mode, content, title: split.title, detail: split.detail };
  if ("unit" in legacy && "startsOn" in legacy) {
    const routine = legacy as unknown as { unit: QuickAddDraft["routineUnit"]; interval: string; startsOn: string; endsOn: string; weekdays: number[]; checklist: string; missedPolicy: QuickAddDraft["routineMissedPolicy"] };
    Object.assign(migrated, { routineUnit: routine.unit, routineInterval: routine.interval, routineStartsOn: routine.startsOn, routineEndsOn: routine.endsOn, routineWeekdays: routine.weekdays, routineChecklist: routine.checklist, routineMissedPolicy: routine.missedPolicy });
  }
  if (legacy.kind && ["note", "resource", "decision"].includes(legacy.kind)) migrated.libraryKind = legacy.kind;
  const areaId = legacy.areaId ?? legacy.projectId;
  if (legacy.goalId) migrated.context = `goal:${legacy.goalId}`;
  else if (areaId !== undefined) migrated.context = areaId ? `area:${areaId}` : "";
  if (legacy.idempotencyKey) migrated.knowledgeIdempotencyKey = legacy.idempotencyKey;
  if (legacy.sourceBookId) migrated.sourceBookId = legacy.sourceBookId;
  if (mode === "library" && migrated.libraryKind === "note" && typeof legacy.content === "string" && legacy.detail === undefined) { migrated.title = legacy.title ?? ""; migrated.detail = legacy.content; }
  for (const field of ["isBook", "resourceAuthor", "readingStatus", "goalKind", "goalTemplateId", "goalCriteria", "firstActionTitle", "routineEndsOn", "routineChecklist", "routineMissedPolicy", "attempted", "receipt", "materialKnowledgeIds", "projectCategoryIds", "projectPreset", "projectPresetManuallyChosen", "contexts", "sourceBookTitle", "actionId", "actionMeaning"] as const) {
    if (legacy[field] !== undefined) Object.assign(migrated, { [field]: legacy[field] });
  }
  // v2 could alias keys across types. Unsubmitted drafts can safely get their
  // own key. An attempted operation or receipt must retain its recovery key.
  migrated.knowledgeIdempotencyKey = legacy.schemaVersion === 2 && !legacy.attempted && !legacy.receipt
    ? crypto.randomUUID()
    : legacy.knowledgeIdempotencyKey || legacy.idempotencyKey || crypto.randomUUID();
  for (const field of ["title", "detail", "context", "scheduledFor", "sourceUrl", "routineInterval", "routineStartsOn"] as const) {
    if (typeof legacy[field] === "string") migrated[field] = legacy[field];
  }
  if (typeof legacy.pinnedToToday === "boolean") migrated.pinnedToToday = legacy.pinnedToToday;
  if (["note", "resource", "decision"].includes(legacy.libraryKind ?? "")) migrated.libraryKind = legacy.libraryKind!;
  if (["day", "week", "month"].includes(legacy.routineUnit ?? "")) migrated.routineUnit = legacy.routineUnit!;
  if (Array.isArray(legacy.goalIds)) migrated.goalIds = legacy.goalIds.filter((id) => typeof id === "string");
  if (Array.isArray(legacy.routineWeekdays)) migrated.routineWeekdays = legacy.routineWeekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return isQuickAddDraft(migrated) ? migrated : undefined;
}


/** Text/options may cross types; the operation identity belongs to the target. */
export function forkCreationDraft(value: QuickAddDraft, target?: QuickAddDraft): QuickAddDraft {
  return { ...value, schemaVersion: 3, attempted: false, receipt: undefined, knowledgeIdempotencyKey: target?.knowledgeIdempotencyKey || crypto.randomUUID() };
}

export function restartRejectedDraft(value: QuickAddDraft): QuickAddDraft {
  return { ...value, attempted: false, knowledgeIdempotencyKey: crypto.randomUUID() };
}
