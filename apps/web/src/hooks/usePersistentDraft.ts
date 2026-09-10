import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useStore } from "../app/useStore";
import { useAuth } from "../auth/useAuth";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";
export type DraftBaseVersion = number | string | null | undefined;

interface DraftEnvelope<T> {
  version: 1 | 2;
  savedAt: string;
  value: T;
  baseVersion?: DraftBaseVersion;
}

interface DraftRead<T> {
  value: T;
  restored: boolean;
  baseVersion?: DraftBaseVersion;
  error?: string;
}

export interface PersistentDraftOptions<T> {
  targetId?: string;
  baseVersion?: DraftBaseVersion;
  enabled?: boolean;
  validate?: (value: unknown) => value is T;
  migrate?: (value: unknown) => T | undefined;
}

const PREFIX = "command-center-draft-v2";
const LEGACY_PREFIX = "command-center-draft-v1";

function segment(value: string) {
  return encodeURIComponent(value);
}

export function draftStorageKey(userId: string, workspaceId: string, kind: string, targetId?: string) {
  const base = `${PREFIX}:${segment(userId)}:${segment(workspaceId)}:${segment(kind)}`;
  return targetId === undefined ? base : `${base}:${segment(targetId)}`;
}

function legacyDraftStorageKey(userId: string, workspaceId: string, kind: string) {
  return `${LEGACY_PREFIX}:${userId}:${workspaceId}:${kind}`;
}

function defaultValidate(value: unknown): value is object | string {
  // Existing capture drafts are plain strings; structured forms use objects.
  return value !== null && (typeof value === "object" || typeof value === "string");
}

function readDraft<T>(key: string | undefined, legacyKey: string | undefined, initialValue: T, validate: (value: unknown) => value is T, migrate?: (value: unknown) => T | undefined): DraftRead<T> {
  if (!key || typeof localStorage === "undefined") return { value: initialValue, restored: false };
  try {
    let raw = localStorage.getItem(key);
    if (!raw && legacyKey) raw = localStorage.getItem(legacyKey);
    if (!raw) return { value: initialValue, restored: false };
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>>;
    if (parsed.version !== 1 && parsed.version !== 2) return { value: initialValue, restored: false, error: "Uszkodzony szkic został pominięty." };
    const migrated = validate(parsed.value) ? parsed.value : migrate?.(parsed.value);
    if (migrated === undefined) return { value: initialValue, restored: false, error: "Uszkodzony szkic został pominięty." };
    return { value: migrated, restored: true, baseVersion: parsed.baseVersion };
  } catch {
    return { value: initialValue, restored: false, error: "Nie udało się odczytać szkicu z tego urządzenia." };
  }
}

export function usePersistentDraft<T>(kind: string, initialValue: T, delay = 450, options: PersistentDraftOptions<T> = {}) {
  const { user, mode } = useAuth();
  const { state } = useStore();
  const workspaceId = state.workspaceId ?? (mode === "demo" ? "demo-workspace" : undefined);
  const ready = options.enabled !== false && Boolean(user?.id && workspaceId);
  const userId = user?.id;
  const targetId = options.targetId;
  const key = useMemo(() => ready && userId && workspaceId ? draftStorageKey(userId, workspaceId, kind, targetId) : undefined, [kind, ready, targetId, userId, workspaceId]);
  const legacyKey = useMemo(() => ready && userId && workspaceId ? legacyDraftStorageKey(userId, workspaceId, kind) : undefined, [kind, ready, userId, workspaceId]);
  const validate = options.validate ?? defaultValidate as (value: unknown) => value is T;
  // The initial value is intentionally read only when the scoped key changes;
  // the following effect handles late server hydration without resetting edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loaded = useMemo(() => readDraft(key, legacyKey, initialValue, validate, options.migrate), [key, legacyKey, options.migrate, validate]);
  const [value, setValueState] = useState<T>(loaded.value);
  const [status, setStatus] = useState<DraftSaveStatus>(loaded.error ? "error" : loaded.restored ? "saved" : "idle");
  const [dirty, setDirty] = useState(loaded.restored);
  const [restored, setRestored] = useState(loaded.restored);
  const [errorMessage, setErrorMessage] = useState(loaded.error);
  const valueRef = useRef(value);
  const dirtyRef = useRef(dirty);
  const baseVersionRef = useRef<DraftBaseVersion>(loaded.baseVersion ?? options.baseVersion);
  const initializedKeyRef = useRef(key);
  const generationRef = useRef(0);
  const initialValueRef = useRef(initialValue);

  valueRef.current = value;
  dirtyRef.current = dirty;

  useEffect(() => {
    generationRef.current += 1;
    initializedKeyRef.current = key;
    initialValueRef.current = initialValue;
    baseVersionRef.current = loaded.baseVersion ?? options.baseVersion;
    setValueState(loaded.value);
    setStatus(loaded.error ? "error" : loaded.restored ? "saved" : "idle");
    setDirty(loaded.restored);
    setRestored(loaded.restored);
    setErrorMessage(loaded.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded]);

  useEffect(() => {
    if (initializedKeyRef.current === key && !dirtyRef.current && !restored) baseVersionRef.current = options.baseVersion;
  }, [key, options.baseVersion, restored]);

  useEffect(() => {
    if (!ready || initializedKeyRef.current !== key || dirtyRef.current || restored) return;
    if (JSON.stringify(initialValueRef.current) === JSON.stringify(initialValue)) return;
    initialValueRef.current = initialValue;
    baseVersionRef.current = options.baseVersion;
    setValueState(initialValue);
  }, [initialValue, key, options.baseVersion, ready, restored]);

  useEffect(() => {
    if (!ready || !key || !dirty || status !== "saving") return;
    const generation = generationRef.current;
    const timer = window.setTimeout(() => {
      if (generation !== generationRef.current) return;
      try {
        const envelope: DraftEnvelope<T> = { version: 2, savedAt: new Date().toISOString(), value: valueRef.current, baseVersion: baseVersionRef.current };
        localStorage.setItem(key, JSON.stringify(envelope));
        if (legacyKey) localStorage.removeItem(legacyKey);
        setErrorMessage(undefined);
        setStatus("saved");
      } catch (caught) {
        setErrorMessage(caught instanceof Error ? caught.message : "Nie udało się zapisać szkicu.");
        setStatus("error");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, dirty, key, legacyKey, ready, status, value]);

  const persistNow = useCallback(() => {
    if (!ready || !key || !dirtyRef.current) return true;
    try {
      const envelope: DraftEnvelope<T> = { version: 2, savedAt: new Date().toISOString(), value: valueRef.current, baseVersion: baseVersionRef.current };
      localStorage.setItem(key, JSON.stringify(envelope));
      if (legacyKey) localStorage.removeItem(legacyKey);
      setErrorMessage(undefined);
      setStatus("saved");
      return true;
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : "Nie udało się zapisać szkicu.");
      setStatus("error");
      return false;
    }
  }, [key, legacyKey, ready]);

  useEffect(() => {
    if (!ready) return;
    const flush = () => { void persistNow(); };
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      // SPA route changes unmount the editor without firing pagehide. Flush
      // synchronously while the old key and identity are still in scope.
      void persistNow();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [persistNow, ready]);

  const setValue = (next: SetStateAction<T>) => {
    setValueState((current) => {
      const resolved = typeof next === "function" ? (next as (value: T) => T)(current) : next;
      valueRef.current = resolved;
      return resolved;
    });
    setDirty(true);
    dirtyRef.current = true;
    setRestored(false);
    setErrorMessage(undefined);
    setStatus("saving");
  };

  const clear = useCallback(() => {
    try {
      if (key) localStorage.removeItem(key);
      if (legacyKey) localStorage.removeItem(legacyKey);
      setValueState(initialValueRef.current);
      valueRef.current = initialValueRef.current;
      setDirty(false);
      dirtyRef.current = false;
      setRestored(false);
      setErrorMessage(undefined);
      setStatus("idle");
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : "Nie udało się odrzucić szkicu.");
      setStatus("error");
    }
  }, [key, legacyKey]);

  return { value, setValue, status, dirty, restored, errorMessage, baseVersion: baseVersionRef.current, flush: persistNow, retry: persistNow, clear, discard: clear, storageKey: key };
}
