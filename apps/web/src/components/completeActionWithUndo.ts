import type { AppStore } from "../app/store-context";
import type { GoalAction } from "../domain/types";
import type { ActionFeedbackValue } from "./action-feedback-context";

export async function completeActionWithUndo({
  action,
  setActionStatus,
  undoActionCompletion,
  notifyUndo,
  hasResult,
  onAddResult,
}: {
  action: GoalAction;
  setActionStatus: AppStore["setActionStatus"];
  undoActionCompletion: AppStore["undoActionCompletion"];
  notifyUndo: ActionFeedbackValue["notifyUndo"];
  hasResult: boolean;
  onAddResult: () => void;
}) {
  const previous = { goalId: action.goalId, status: action.status, blocker: action.blocker, reviewOn: action.reviewOn, isNext: action.isNext };
  const undoCommandId = crypto.randomUUID();
  await setActionStatus(action.id, "completed", undefined, action.version, null);
  let undoCommitted = false;
  let undoInFlight: Promise<void> | undefined;
  notifyUndo({
    message: "Działanie ukończone.",
    undo: async () => {
      if (undoCommitted) return;
      if (undoInFlight) return undoInFlight;
      undoInFlight = undoActionCompletion({
        actionId: action.id,
        goalId: previous.goalId,
        expectedVersion: action.version + 1,
        restoreStatus: previous.status,
        restoreBlocker: previous.blocker,
        restoreReviewOn: previous.reviewOn ?? null,
        restoreIsNext: previous.isNext,
        commandId: undoCommandId
      });
      try {
        await undoInFlight;
        undoCommitted = true;
      } catch (error) {
        undoInFlight = undefined;
        throw error;
      }
    },
    ...(!hasResult ? { action: { label: "Dodaj rezultat", onClick: onAddResult } } : {}),
  });
}
