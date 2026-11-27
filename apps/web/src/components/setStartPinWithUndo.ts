import type { AppStore } from "../app/store-context";
import type { GoalAction } from "../domain/types";
import type { ActionFeedbackValue } from "./action-feedback-context";

export async function setStartPinWithUndo(
  action: GoalAction,
  pinned: boolean,
  updateAction: AppStore["updateAction"],
  notifyUndo: ActionFeedbackValue["notifyUndo"],
) {
  await updateAction(action.id, { pinnedToToday: pinned }, action.version);
  notifyUndo({
    message: pinned ? "Działanie przypięte do Startu." : "Działanie odpięte od Startu.",
    undo: () => updateAction(action.id, { pinnedToToday: action.pinnedToToday }, action.version + 1),
  });
}
