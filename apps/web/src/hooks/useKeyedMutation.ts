import { useCallback, useContext, useRef, useState } from "react";
import { ActionFeedbackContext } from "../components/action-feedback-context";
import { describeMutationError } from "../lib/mutationError";

interface MutationState {
  busy: boolean;
  error?: string;
  retry?: () => Promise<boolean>;
}

export function useKeyedMutation() {
  const feedback = useContext(ActionFeedbackContext);
  const [states, setStates] = useState<Record<string, MutationState>>({});
  const running = useRef(new Set<string>());

  const run = useCallback(async (key: string, operation: () => Promise<void>) => {
    if (running.current.has(key)) return false;
    running.current.add(key);
    const retry = () => run(key, operation);
    setStates((current) => ({ ...current, [key]: { busy: true, retry } }));
    try {
      await operation();
      setStates((current) => ({ ...current, [key]: { busy: false } }));
      return true;
    } catch (caught) {
      const error = describeMutationError(caught);
      setStates((current) => ({ ...current, [key]: { busy: false, error, retry } }));
      feedback?.notifyError(error);
      return false;
    } finally {
      running.current.delete(key);
    }
  }, [feedback]);

  return {
    run,
    isBusy: (key: string) => states[key]?.busy ?? false,
    error: (key: string) => states[key]?.error,
    retry: (key: string) => states[key]?.retry
  };
}
