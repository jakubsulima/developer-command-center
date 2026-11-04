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
  alternatives?: Array<{ key: string; value: T }>;
  sources?: Array<{ key: string; raw: string }>;
}

export interface PersistentDraftOptions<T> {
  targetId?: string;
  migrateFrom?: { kind: string; targetId?: string } | Array<{ kind: string; targetId?: string }>;
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

function readDraft<T>(key: string | undefined, fallbackKeys: Array<string | undefined>, initialValue: T, validate: (value: unknown) => value is T, migrate?: (value: unknown) => T | undefined): DraftRead<T> {
  if (!key || typeof localStorage === "undefined") return { value: initialValue, restored: false };
  try {
    const recoveryKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((candidate): candidate is string => Boolean(candidate?.startsWith(`${key}:recovery:`)));
    let result: DraftRead<T> | undefined;
    let invalid = false;
    for (const candidate of [...new Set([key, ...fallbackKeys, ...recoveryKeys])]) {
      if (!candidate) continue;
      const raw = localStorage.getItem(candidate);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>>;
        const migrated = (parsed.version === 1 || parsed.version === 2) ? (validate(parsed.value) ? parsed.value : migrate?.(parsed.value)) : undefined;
        if (migrated === undefined) { invalid = true; continue; }
        if (!result) result = { value: migrated, restored: true, baseVersion: parsed.baseVersion, alternatives: [], sources: [{ key: candidate, raw }] };
        else if (JSON.stringify(result.value) === JSON.stringify(migrated)) result.sources!.push({ key: candidate, raw });
        else result.alternatives!.push({ key: candidate, value: migrated });
      } catch { invalid = true; }
    }
    return result ?? { value: initialValue, restored: false, error: invalid ? "Uszkodzony szkic został pominięty." : undefined };
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
  const migrationSignature = JSON.stringify(options.migrateFrom ?? []);
  const fallbackKeys = useMemo(() => {
    const sources = JSON.parse(migrationSignature) as PersistentDraftOptions<T>["migrateFrom"];
    const entries = Array.isArray(sources) ? sources : sources ? [sources] : [];
    return [...entries.flatMap((source) => ready && userId && workspaceId ? [draftStorageKey(userId, workspaceId, source.kind, source.targetId), legacyDraftStorageKey(userId, workspaceId, source.kind)] : []), legacyKey];
  }, [legacyKey, migrationSignature, ready, userId, workspaceId]);
  const validate = options.validate ?? defaultValidate as (value: unknown) => value is T;
  // The initial value is intentionally read only when the scoped key changes;
  // the following effect handles late server hydration without resetting edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loaded = useMemo(() => readDraft(key, fallbackKeys, initialValue, validate, options.migrate), [fallbackKeys, key]);
  const [value, setValueState] = useState<T>(loaded.value);
  const [status, setStatus] = useState<DraftSaveStatus>(loaded.error ? "error" : loaded.restored ? "saved" : "idle");
  const [dirty, setDirty] = useState(loaded.restored);
  const [restored, setRestored] = useState(loaded.restored);
  const [errorMessage, setErrorMessage] = useState(loaded.error);
  const [alternatives, setAlternatives] = useState(loaded.alternatives ?? []);
  const sourcesRef = useRef(loaded.sources ?? []);
  const valueRef = useRef(value);
  const dirtyRef = useRef(dirty);
  const baseVersionRef = useRef<DraftBaseVersion>(loaded.baseVersion ?? options.baseVersion);
  const initializedKeyRef = useRef(key);
  const generationRef = useRef(0);
  const initialValueRef = useRef(initialValue);
  const inputValueRef = useRef(initialValue);
  const instanceRef = useRef(crypto.randomUUID());

  valueRef.current = value;
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!kind.startsWith("creation:") || !key) return;
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; origin: string; value: T; cleared?: boolean }>).detail;
      if (detail.key !== key || detail.origin === instanceRef.current) return;
      generationRef.current += 1;
      valueRef.current = detail.value;
      dirtyRef.current = !detail.cleared;
      setValueState(detail.value); setDirty(!detail.cleared); setRestored(!detail.cleared); setStatus(detail.cleared ? "idle" : "saved");
    };
    window.addEventListener("creation:draft", sync);
    return () => window.removeEventListener("creation:draft", sync);
  }, [key, kind]);

  useEffect(() => {
    generationRef.current += 1;
    initializedKeyRef.current = key;
    initialValueRef.current = initialValue;
    inputValueRef.current = initialValue;
    baseVersionRef.current = loaded.baseVersion ?? options.baseVersion;
    valueRef.current = loaded.value;
    dirtyRef.current = loaded.restored;
    setValueState(loaded.value);
    setStatus(loaded.error ? "error" : loaded.restored ? "saved" : "idle");
    setDirty(loaded.restored);
    setRestored(loaded.restored);
    setErrorMessage(loaded.error);
    setAlternatives(loaded.alternatives ?? []);
    sourcesRef.current = loaded.sources ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded]);

  useEffect(() => {
    if (initializedKeyRef.current === key && !dirtyRef.current && !restored) baseVersionRef.current = options.baseVersion;
  }, [key, options.baseVersion, restored]);

  useEffect(() => {
    if (!ready || initializedKeyRef.current !== key || dirtyRef.current || restored) return;
    if (JSON.stringify(inputValueRef.current) === JSON.stringify(initialValue)) return;
    inputValueRef.current = initialValue;
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
        if (kind.startsWith("creation:")) window.dispatchEvent(new CustomEvent("creation:draft", { detail: { key, origin: instanceRef.current, value: valueRef.current } }));
        setErrorMessage(undefined);
        setStatus("saved");
      } catch (caught) {
        setErrorMessage(caught instanceof Error ? caught.message : "Nie udało się zapisać szkicu.");
        setStatus("error");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, dirty, fallbackKeys, key, kind, ready, status, value]);

  const persistNow = useCallback(() => {
    if (!ready || !key || !dirtyRef.current) return true;
    try {
      const envelope: DraftEnvelope<T> = { version: 2, savedAt: new Date().toISOString(), value: valueRef.current, baseVersion: baseVersionRef.current };
      localStorage.setItem(key, JSON.stringify(envelope));
      if (kind.startsWith("creation:")) window.dispatchEvent(new CustomEvent("creation:draft", { detail: { key, origin: instanceRef.current, value: valueRef.current } }));
      setErrorMessage(undefined);
      setStatus("saved");
      return true;
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : "Nie udało się zapisać szkicu.");
      setStatus("error");
      return false;
    }
  }, [key, kind, ready]);

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
    const resolved = typeof next === "function" ? (next as (value: T) => T)(valueRef.current) : next;
    valueRef.current = resolved;
    setValueState(resolved);
    setDirty(true);
    dirtyRef.current = true;
    setRestored(false);
    setErrorMessage(undefined);
    setStatus("saving");
  };

  const clear = useCallback((nextValue?: T) => {
    try {
      if (key) localStorage.removeItem(key);
      for (const source of sourcesRef.current) if (source.key !== key && localStorage.getItem(source.key) === source.raw) localStorage.removeItem(source.key);
      const resetValue = nextValue ?? initialValueRef.current;
      if (nextValue !== undefined) initialValueRef.current = nextValue;
      setValueState(resetValue);
      valueRef.current = resetValue;
      setDirty(false);
      dirtyRef.current = false;
      setRestored(false);
      setErrorMessage(undefined);
      setStatus("idle");
      if (kind.startsWith("creation:")) window.dispatchEvent(new CustomEvent("creation:draft", { detail: { key, origin: instanceRef.current, value: resetValue, cleared: true } }));
      return true;
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : "Nie udało się odrzucić szkicu.");
      setStatus("error");
      return false;
    }
  }, [key, kind]);

  const recover = (sourceKey: string) => {
    const source = alternatives.find((item) => item.key === sourceKey);
    if (!source || !key || !persistNow()) return false;
    try {
      // Keep both versions available; recovering never overwrites the only copy.
      localStorage.setItem(`${key}:recovery:${crypto.randomUUID()}`, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), value: valueRef.current }));
      const raw = localStorage.getItem(source.key);
      sourcesRef.current = raw ? [{ key: source.key, raw }] : [];
      setValue(source.value);
      return persistNow();
    } catch { setErrorMessage("Nie udało się zachować obu szkiców. Skopiuj treść przed odzyskaniem."); setStatus("error"); return false; }
  };
  const preserveAlternative = useCallback((alternative: T) => {
    if (!key || !ready) return false;
    try {
      const recoveryKey = `${key}:recovery:${crypto.randomUUID()}`;
      localStorage.setItem(recoveryKey, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), value: alternative }));
      setAlternatives((current) => [...current, { key: recoveryKey, value: alternative }]);
      return true;
    } catch { setErrorMessage("Nie udało się zachować obu szkiców. Treść pozostała w poprzednim formularzu."); setStatus("error"); return false; }
  }, [key, ready]);
  return { value, setValue, status, dirty, restored, errorMessage, alternatives, recover, preserveAlternative, baseVersion: baseVersionRef.current, flush: persistNow, retry: persistNow, clear, discard: () => clear(), storageKey: key };
}
