import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useStore } from "../app/useStore";
import { useAuth } from "../auth/useAuth";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

interface DraftEnvelope<T> {
  version: 1;
  savedAt: string;
  value: T;
}

const PREFIX = "command-center-draft-v1";

export function draftStorageKey(userId: string, workspaceId: string, kind: string) {
  return `${PREFIX}:${userId}:${workspaceId}:${kind}`;
}

function readDraft<T>(key: string, initialValue: T) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { value: initialValue, restored: false };
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (parsed.version !== 1) return { value: initialValue, restored: false };
    return { value: parsed.value, restored: true };
  } catch {
    return { value: initialValue, restored: false };
  }
}

export function usePersistentDraft<T>(kind: string, initialValue: T, delay = 450) {
  const { user } = useAuth();
  const { state } = useStore();
  const workspaceId = state.workspaceId ?? "local";
  const userId = user?.id ?? "anonymous";
  const key = useMemo(() => draftStorageKey(userId, workspaceId, kind), [kind, userId, workspaceId]);
  const initial = useRef(initialValue).current;
  const loaded = useMemo(() => readDraft(key, initial), [initial, key]);
  const [value, setValueState] = useState<T>(loaded.value);
  const [status, setStatus] = useState<DraftSaveStatus>(loaded.restored ? "saved" : "idle");
  const [dirty, setDirty] = useState(loaded.restored);

  useEffect(() => {
    setValueState(loaded.value);
    setStatus(loaded.restored ? "saved" : "idle");
    setDirty(loaded.restored);
  }, [loaded]);

  useEffect(() => {
    if (!dirty || status !== "saving") return;
    const timer = window.setTimeout(() => {
      try {
        const envelope: DraftEnvelope<T> = { version: 1, savedAt: new Date().toISOString(), value };
        localStorage.setItem(key, JSON.stringify(envelope));
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, dirty, key, status, value]);

  const setValue = (next: SetStateAction<T>) => {
    setValueState(next);
    setDirty(true);
    setStatus("saving");
  };

  const clear = () => {
    try {
      localStorage.removeItem(key);
      setValueState(initial);
      setDirty(false);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return { value, setValue, status, dirty, restored: loaded.restored, clear, discard: clear, storageKey: key };
}
