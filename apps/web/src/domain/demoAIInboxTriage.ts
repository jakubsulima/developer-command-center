import type { AppState, InboxItem } from "./types";
import { AI_INBOX_TRIAGE_SCHEMA_VERSION, type AIInboxTriageProposal } from "./aiInboxTriage";

function linkedTarget(content: string, state: AppState) {
  const words = content.toLocaleLowerCase("pl-PL").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4);
  const score = (title: string) => words.filter((word) => title.toLocaleLowerCase("pl-PL").includes(word)).length;
  const candidates = [...state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").map((goal) => ({ type: "goal" as const, id: goal.id, title: goal.title })), ...state.areas.filter((project) => project.visibility === "active").map((project) => ({ type: "project" as const, id: project.id, title: project.name }))];
  const best = candidates.map((candidate) => ({ candidate, score: score(candidate.title) })).sort((left, right) => right.score - left.score)[0];
  return best && best.score > 0 ? { linkedType: best.candidate.type, linkedId: best.candidate.id } : { linkedType: "none" as const, linkedId: null };
}

export function createDemoAIInboxTriageProposal(state: AppState, item: InboxItem, cached = false): AIInboxTriageProposal {
  const content = item.content.trim();
  const target = linkedTarget(content, state);
  const isLink = item.kind === "link" || /^https?:\/\//i.test(content);
  const isAction = /\b(zrób|zrob|napisz|dodaj|sprawdź|sprawdz|przygotuj|umów|umow|wyślij|wyslij|wdroż|wdroz|uruchom|zaplanuj|kup|przeczytaj)\b/i.test(content);
  const isGoal = /\b(chcę|chce|muszę|musze|cel|osiągnąć|osiagnac|nauczyć|nauczyc)\b/i.test(content);
  const proposal = content.length < 12 ? { schemaVersion: AI_INBOX_TRIAGE_SCHEMA_VERSION, decision: "keep_inbox" as const, confidence: "low" as const, reason: "Treść jest zbyt krótka, aby bezpiecznie określić rezultat.", title: null, detail: null, knowledgeKind: null, linkedType: "none" as const, linkedId: null, targetDate: null } : isLink ? { schemaVersion: AI_INBOX_TRIAGE_SCHEMA_VERSION, decision: "knowledge" as const, confidence: "high" as const, reason: "Element jest linkiem, więc najbezpieczniej zachować go jako Materiał.", title: content.slice(0, 300), detail: content, knowledgeKind: "resource" as const, ...target, targetDate: null } : isAction ? { schemaVersion: AI_INBOX_TRIAGE_SCHEMA_VERSION, decision: "action" as const, confidence: "high" as const, reason: "Treść opisuje pojedynczy krok możliwy do wykonania.", title: content.slice(0, 300), detail: content, knowledgeKind: null, ...target, targetDate: null } : isGoal ? { schemaVersion: AI_INBOX_TRIAGE_SCHEMA_VERSION, decision: "goal" as const, confidence: "medium" as const, reason: "Treść wygląda na rezultat, który warto doprecyzować jako Cel.", title: content.slice(0, 300), detail: `Rezultat: ${content}`, knowledgeKind: null, ...target, targetDate: null } : { schemaVersion: AI_INBOX_TRIAGE_SCHEMA_VERSION, decision: "keep_inbox" as const, confidence: "low" as const, reason: "Nie ma wystarczających sygnałów, aby wybrać typ bez ryzyka błędnego triage.", title: null, detail: null, knowledgeKind: null, linkedType: "none" as const, linkedId: null, targetDate: null };
  return { proposalId: `demo-inbox-triage-${item.id}`, inboxItemId: item.id, status: "ready", cached, generatedAt: new Date().toISOString(), provider: "demo", model: "deterministic", proposal };
}
