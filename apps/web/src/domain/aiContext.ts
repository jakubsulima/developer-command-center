import { buildContextBundle, type ContextRequest, type ContextSection, type ContextSource, type ContextOmission } from "../../../../packages/ai-context/src/index";
import type { AppState } from "./types";
import { actionStatusLabels, goalStatusLabels, knowledgeKindLabels, progressKindLabels } from "./labels";
import { readingPositionLabel } from "./readingProgress";
export type ContextData = Pick<AppState, "areas" | "goals" | "goalCriteria" | "actions" | "progressEntries" | "knowledge"> & { workspaceId: string; readLimited?: boolean; contextMismatch?: boolean };
export function selectLocalContextData(state: AppState, request: ContextRequest): ContextData {
  const { type, id } = request.target;
  const action = type === "action" ? state.actions.find((item) => item.id === id) : undefined;
  const goal = state.goals.find((item) => item.id === (type === "goal" ? id : action?.goalId));
  const projectId = type === "project" ? id : action?.goalId ? goal?.areaId : action?.areaId ?? goal?.areaId;
  const project = state.areas.find((area) => area.id === projectId && area.visibility === "active");
  if (type === "action" && !action || type === "goal" && (!goal || goal.visibility !== "active") || type === "project" && !project) throw new Error("Obiekt kontekstu jest niedostępny.");
  const excluded = new Set(request.selection.excludedSourceIds);
  const goals = state.goals.filter((item) => item.visibility === "active" && (type === "project" ? request.selection.includeGoal && item.areaId === projectId && item.status === "active" : item.id === goal?.id && (type === "goal" || request.selection.includeGoal))).filter((item) => item.id === id || !excluded.has(`goal:${item.id}`)).sort((a,b) => a.id.localeCompare(b.id)).slice(0,21);
  const actions = type === "action" ? [action!] : state.actions.filter((item) => !["completed","cancelled","skipped"].includes(item.status) && (type === "goal" ? item.goalId === id : item.areaId === projectId || state.goals.some((goal) => goal.id === item.goalId && goal.areaId === projectId && goal.visibility === "active"))).filter((item) => !excluded.has(`action:${item.id}`)).sort((a,b) => Number(b.isNext) - Number(a.isNext) || a.position - b.position || a.id.localeCompare(b.id)).slice(0,21);
  const progress = state.progressEntries.filter((entry) => request.selection.includeProgress && state.goals.some((g) => g.id === entry.goalId && g.visibility === "active") && (type === "action" ? entry.actionId === id || entry.goalId === goal?.id : type === "goal" ? entry.goalId === id : state.goals.some((g) => g.id === entry.goalId && g.areaId === projectId))).filter((item) => !excluded.has(`progress:${item.id}`)).sort((a,b) => Number(b.actionId === id) - Number(a.actionId === id) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0,6);
  const extra = request.selection.extraKnowledgeIds;
  const linkedIds = new Set(state.knowledgeLinks.filter((link) => type === "action" && link.actionId === id || Boolean(goal && link.goalId === goal.id) || Boolean(projectId && link.areaId === projectId)).map((link) => link.knowledgeItemId));
  const knowledge = state.knowledge.filter((item) => request.selection.includeKnowledge && !item.archivedAt && !item.trashedAt && (extra.includes(item.id) || linkedIds.has(item.id)) && !excluded.has(`knowledge:${item.id}`)).sort((a,b) => {
    const left = extra.indexOf(a.id), right = extra.indexOf(b.id);
    return (left < 0 ? 100 : left) - (right < 0 ? 100 : right) || (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? "") || a.id.localeCompare(b.id);
  }).slice(0,11);
  return { workspaceId: state.workspaceId ?? "demo", areas: project && (request.selection.includeProject || type === "project") ? [project] : [], goals, goalCriteria: state.goalCriteria.filter((item) => goals.some((g) => g.id === item.goalId)), actions, progressEntries: progress, knowledge, contextMismatch: Boolean(action?.areaId && action?.goalId && action.areaId !== goal?.areaId) };
}
export function contextBundleFromData(data: ContextData, request: ContextRequest, generatedAt = new Date().toISOString()) {
  const sections: ContextSection[] = [];
  const omissions: ContextOmission[] = [];
  const source = (type: ContextSource["type"], item: { id: string; title?: string; name?: string; version?: number; updatedAt?: string; createdAt?: string }): ContextSource => ({ key: `${type}:${item.id}`, type, id: item.id, title: item.title ?? item.name ?? "Aktualizacja postępu", route: type === "project" ? `/projects/${item.id}` : type === "progress" ? `/goals/${data.progressEntries.find((p) => p.id === item.id)?.goalId ?? ""}` : `/${type === "knowledge" ? "knowledge" : `${type}s`}/${item.id}`, updatedAt: item.updatedAt ?? item.createdAt ?? null, version: item.version ?? null });
  for (const area of data.areas) sections.push({ type: "project", source: source("project",area), description: area.description ?? "" });
  for (const goal of data.goals.slice(0,20)) sections.push({ type: "goal", source: source("goal",goal), outcome: goal.outcome, status: goalStatusLabels[goal.status], criteria: data.goalCriteria.filter((item) => item.goalId === goal.id).map(({ title, completed }) => ({ title, completed })) });
  for (const action of data.actions.slice(0,20)) sections.push({ type: "action", source: source("action",action), detail: action.detail, status: actionStatusLabels[action.status], blocker: action.blocker, reviewOn: action.reviewOn, scheduledFor: action.scheduledFor, checklist: action.checklist });
  for (const entry of data.progressEntries.slice(0,5)) sections.push({ type: "progress", source: source("progress",entry), kind: progressKindLabels[entry.kind], content: entry.content });
  for (const knowledge of data.knowledge.slice(0,10)) sections.push({ type: "knowledge", source: source("knowledge",knowledge), kind: knowledgeKindLabels[knowledge.type], detail: knowledge.detail, url: knowledge.sourceUrl, readingPosition: readingPositionLabel(knowledge) || undefined });
  for (const [name, items, limit] of [["goals",data.goals,20],["actions",data.actions,20],["progress",data.progressEntries,5],["knowledge",data.knowledge,10]] as const) if (items.length > limit) omissions.push({ sourceKey: name, reason: `Uwzględniono maksymalnie ${limit} rekordów.` });
  if (data.readLimited) omissions.push({ sourceKey: "content", reason: "Odczyt ograniczono do 40 000 znaków treści oraz 25 elementów jednej listy." });
  if (data.contextMismatch) omissions.push({ sourceKey: "context", reason: "Projekt Działania różni się od Projektu jego Celu. Uwzględniono Projekt Celu." });
  if (request.selection.includeKnowledge && request.selection.extraKnowledgeIds.some((id) => !data.knowledge.some((item) => item.id === id))) omissions.push({ sourceKey: "knowledge", reason: "Niektóre dodatkowe źródła są niedostępne lub zostały wykluczone." });
  const mainKey = `${request.target.type}:${request.target.id}`;
  const main = sections.find((section) => section.source.key === mainKey);
  if (!main) throw new Error("Obiekt kontekstu jest niedostępny. Odśwież dane.");
  const rootAction = request.target.type === "action" ? data.actions.find((item) => item.id === request.target.id) : undefined;
  const rootGoal = data.goals.find((item) => item.id === (request.target.type === "goal" ? request.target.id : rootAction?.goalId));
  if (request.selection.includeGoal && rootAction?.goalId && !rootGoal) omissions.push({ sourceKey: "goal", reason: "Powiązany Cel jest niedostępny w aktualnym zakresie." });
  const parentProjectId = rootGoal?.areaId ?? rootAction?.areaId;
  if (request.selection.includeProject && parentProjectId && !data.areas.some((area) => area.id === parentProjectId)) omissions.push({ sourceKey: "project", reason: "Powiązany Projekt jest niedostępny w aktualnym zakresie." });
  return buildContextBundle(request,{ workspaceId: data.workspaceId, sections: [main,...sections.filter((section) => section !== main)], omissions }, generatedAt);
}
