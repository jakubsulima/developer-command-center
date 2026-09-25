import type { AppState } from "../domain/types";
import { DEFAULT_AI_REVIEW_SETTINGS } from "../domain/aiReviewSettings";

export const emptyState: AppState = {
  workspaceTimezone: "Europe/Warsaw",
  aiReviewSettings: { ...DEFAULT_AI_REVIEW_SETTINGS },
  areas: [],
  projectCategories: [],
  goalTemplates: [],
  goals: [],
  goalCriteria: [],
  actions: [],
  progressEntries: [],
  recurringActionTemplates: [],
  knowledgeLinks: [],
  projects: [],
  checkpoints: [],
  inbox: [],
  evidence: [],
  learningGoals: [],
  knowledge: [],
  reviews: [],
  aiProposals: [],
  aiExecutions: [],
  focusSessions: [],
  focus: {
    running: false,
    elapsedBeforeStart: 0,
    projectId: "",
    workItemId: "",
    scratchpad: ""
  },
  aiProposal: "rejected"
};
