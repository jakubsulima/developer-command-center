import { useCallback, useContext, useRef, useState } from "react";
import { ActionFeedbackContext } from "../components/action-feedback-context";

interface MutationState {
  busy: boolean;
  error?: string;
  retry?: () => Promise<void>;
}

export function useKeyedMutation() {
  const feedback = useContext(ActionFeedbackContext);
  const [states, setStates] = useState<Record<string, MutationState>>({});
  const running = useRef(new Set<string>());

  const run = useCallback(async (key: string, operation: () => Promise<void>) => {
    if (running.current.has(key)) return;
    running.current.add(key);
    const retry = () => run(key, operation);
    setStates((current) => ({ ...current, [key]: { busy: true, retry } }));
    try {
      await operation();
      setStates((current) => ({ ...current, [key]: { busy: false } }));
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Nie udało się zapisać zmiany.";
      setStates((current) => ({ ...current, [key]: { busy: false, error, retry } }));
      feedback?.notifyError(error);
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
