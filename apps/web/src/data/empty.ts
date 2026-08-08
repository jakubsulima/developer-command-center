import type { AppState } from "../domain/types";

export const emptyState: AppState = {
  workspaceTimezone: "Europe/Warsaw",
  areas: [],
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
