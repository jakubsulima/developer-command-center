import { createContext, useContext } from "react";
import type { ActionStatus } from "../domain/types";

export type ActionFeedbackEvent = "saved" | "changed" | "completed" | "blocked" | "archived";

export interface UndoNoticeInput {
  message: string;
  event?: ActionFeedbackEvent;
  undo: () => Promise<void> | void;
  action?: { label: string; onClick: () => Promise<void> | void };
  durationMs?: number;
}

export function actionStatusFeedbackEvent(status: ActionStatus): ActionFeedbackEvent {
  if (status === "completed") return "completed";
  if (status === "blocked") return "blocked";
  return "changed";
}

export interface ActionFeedbackValue {
  notifyUndo: (input: UndoNoticeInput) => void;
  notifySuccess: (message: string, action?: UndoNoticeInput["action"]) => void;
  notifyError: (message: string) => void;
}

export const ActionFeedbackContext = createContext<ActionFeedbackValue | null>(null);

export function useActionFeedback() {
  const value = useContext(ActionFeedbackContext);
  if (!value) throw new Error("useActionFeedback must be used within ActionFeedbackProvider");
  return value;
}
