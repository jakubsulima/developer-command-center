import { createContext, useContext } from "react";

export interface UndoNoticeInput {
  message: string;
  undo: () => Promise<void> | void;
  durationMs?: number;
}

export interface ActionFeedbackValue {
  notifyUndo: (input: UndoNoticeInput) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
}

export const ActionFeedbackContext = createContext<ActionFeedbackValue | null>(null);

export function useActionFeedback() {
  const value = useContext(ActionFeedbackContext);
  if (!value) throw new Error("useActionFeedback must be used within ActionFeedbackProvider");
  return value;
}
