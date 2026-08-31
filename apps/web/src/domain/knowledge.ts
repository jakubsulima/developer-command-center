import type { AppState, KnowledgeKind, KnowledgeLink, KnowledgeRelationMeaning, KnowledgeTarget } from "./types";

export interface ResolvedKnowledgeRelation {
  link: KnowledgeLink;
  target: KnowledgeTarget;
  label: string;
}

export interface KnowledgeProjectContext {
  projectId: string;
  source: "direct" | "goal" | "action" | "recurring-action";
  sourceId: string;
}

function targetFromLink(link: KnowledgeLink): KnowledgeTarget {
  if (link.targetKnowledgeItemId) return { kind: "knowledge", id: link.targetKnowledgeItemId };
  if (link.areaId) return { kind: "project", id: link.areaId };
  if (link.goalId) return { kind: "goal", id: link.goalId };
  if (link.actionId) return { kind: "action", id: link.actionId };
  if (link.recurringTemplateId) return { kind: "recurring-action", id: link.recurringTemplateId };
  throw new Error("knowledge_link_target_required");
}

function targetFields(target: KnowledgeTarget): KnowledgeLink {
  return target.kind === "project" ? { areaId: target.id } as KnowledgeLink
    : target.kind === "goal" ? { goalId: target.id } as KnowledgeLink
      : target.kind === "action" ? { actionId: target.id } as KnowledgeLink
        : target.kind === "recurring-action" ? { recurringTemplateId: target.id } as KnowledgeLink
          : { targetKnowledgeItemId: target.id } as KnowledgeLink;
}

export function knowledgeTargetToFields(target: KnowledgeTarget) {
  const fields = targetFields(target);
  return {
    targetKnowledgeItemId: fields.targetKnowledgeItemId,
    areaId: fields.areaId,
    goalId: fields.goalId,
    actionId: fields.actionId,
    recurringTemplateId: fields.recurringTemplateId
  };
}

export function validateKnowledgeTarget(state: AppState, sourceId: string, sourceType: KnowledgeKind, target: KnowledgeTarget, meaning: KnowledgeRelationMeaning) {
  if (target.kind === "knowledge" && target.id === sourceId) throw new Error("knowledge_self_link_not_allowed");
  const exists = target.kind === "project" ? state.areas.some((item) => item.id === target.id)
    : target.kind === "goal" ? state.goals.some((item) => item.id === target.id)
      : target.kind === "action" ? state.actions.some((item) => item.id === target.id)
        : target.kind === "recurring-action" ? state.recurringActionTemplates.some((item) => item.id === target.id)
          : state.knowledge.some((item) => item.id === target.id);
  if (!exists) throw new Error(target.kind === "project" ? "area_not_found" : target.kind === "goal" ? "goal_not_found" : target.kind === "action" ? "action_not_found" : target.kind === "recurring-action" ? "recurring_template_not_found" : "knowledge_target_not_found");
  if (meaning === "result" && sourceType !== "artifact") throw new Error("knowledge_result_requires_artifact");
  if (meaning === "decision" && sourceType !== "decision") throw new Error("knowledge_decision_requires_decision");
  const fields = knowledgeTargetToFields(target);
  if (state.knowledgeLinks.some((link) => link.knowledgeItemId === sourceId && link.meaning === meaning
    && link.targetKnowledgeItemId === fields.targetKnowledgeItemId && link.areaId === fields.areaId
    && link.goalId === fields.goalId && link.actionId === fields.actionId && link.recurringTemplateId === fields.recurringTemplateId)) {
    return false;
  }
  return true;
}

function relationLabel(state: AppState, target: KnowledgeTarget) {
  if (target.kind === "project") return state.areas.find((item) => item.id === target.id)?.name ?? target.id;
  if (target.kind === "goal") return state.goals.find((item) => item.id === target.id)?.title ?? target.id;
  if (target.kind === "action") return state.actions.find((item) => item.id === target.id)?.title ?? target.id;
  if (target.kind === "recurring-action") return state.recurringActionTemplates.find((item) => item.id === target.id)?.title ?? target.id;
  return state.knowledge.find((item) => item.id === target.id)?.title ?? target.id;
}

function orderedLinks(links: KnowledgeLink[]) {
  return [...links].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

/** Resolves both directions without recursively propagating Knowledge context. */
export function resolveKnowledgeRelations(state: AppState, knowledgeId: string) {
  const outgoing: ResolvedKnowledgeRelation[] = orderedLinks(state.knowledgeLinks.filter((link) => link.knowledgeItemId === knowledgeId)).map((link) => {
    const target = targetFromLink(link);
    return { link, target, label: relationLabel(state, target) };
  });
  const incoming: ResolvedKnowledgeRelation[] = orderedLinks(state.knowledgeLinks.filter((link) => link.targetKnowledgeItemId === knowledgeId)).map((link) => ({
    link,
    target: { kind: "knowledge", id: link.knowledgeItemId },
    label: relationLabel(state, { kind: "knowledge", id: link.knowledgeItemId })
  }));
  return { outgoing, incoming };
}

export function resolveKnowledgeProjectContexts(state: AppState, knowledgeId: string): KnowledgeProjectContext[] {
  const contexts = new Map<string, KnowledgeProjectContext>();
  for (const link of state.knowledgeLinks.filter((candidate) => candidate.knowledgeItemId === knowledgeId)) {
    if (link.areaId) contexts.set(`direct:${link.areaId}`, { projectId: link.areaId, source: "direct", sourceId: link.areaId });
    if (link.goalId) {
      const goal = state.goals.find((item) => item.id === link.goalId);
      if (goal?.areaId) contexts.set(`goal:${goal.areaId}`, { projectId: goal.areaId, source: "goal", sourceId: goal.id });
    }
    if (link.actionId) {
      const action = state.actions.find((item) => item.id === link.actionId);
      if (action?.areaId) contexts.set(`action:${action.areaId}`, { projectId: action.areaId, source: "action", sourceId: action.id });
      if (action?.goalId) {
        const goal = state.goals.find((item) => item.id === action.goalId);
        if (goal?.areaId) contexts.set(`action-goal:${goal.areaId}`, { projectId: goal.areaId, source: "action", sourceId: action.id });
      }
    }
    if (link.recurringTemplateId) {
      const recurring = state.recurringActionTemplates.find((item) => item.id === link.recurringTemplateId);
      if (recurring?.areaId) contexts.set(`recurring:${recurring.areaId}`, { projectId: recurring.areaId, source: "recurring-action", sourceId: recurring.id });
      if (recurring?.goalId) {
        const goal = state.goals.find((item) => item.id === recurring.goalId);
        if (goal?.areaId) contexts.set(`recurring-goal:${goal.areaId}`, { projectId: goal.areaId, source: "recurring-action", sourceId: recurring.id });
      }
    }
  }
  return [...contexts.values()].sort((left, right) => left.projectId.localeCompare(right.projectId) || left.source.localeCompare(right.source));
}
