import { useEffect, useMemo, useState } from "react";
import type { CreationReceipt } from "./creationDraft";

/** A confirmed result is distinct from draft cleanup, including after reopening. */
export function useCreationReceipt(storageKey?: string, backup?: { value?: CreationReceipt; save: (receipt: CreationReceipt) => boolean }) {
  const key = storageKey ? `${storageKey}:receipt` : undefined;
  const loaded = useMemo<CreationReceipt | undefined>(() => {
    try { const raw = key && localStorage.getItem(key); if (!raw) return undefined; const value = JSON.parse(raw) as CreationReceipt; return value && typeof value.id === "string" && typeof value.url === "string" && typeof value.message === "string" ? value : undefined; }
    catch { return undefined; }
  }, [key]);
  const [override, setOverride] = useState<{ key: string | undefined; value: CreationReceipt | undefined }>();
  const receipt = override && override.key === key ? override.value : loaded ?? backup?.value;
  const setReceipt = (value: CreationReceipt | undefined) => setOverride({ key, value });
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: CreationReceipt }>).detail;
      if (detail.key === key) setOverride({ key, value: detail.value });
    };
    window.addEventListener("creation:receipt", receive);
    return () => window.removeEventListener("creation:receipt", receive);
  }, [key]);
  const publish = (value?: CreationReceipt) => window.dispatchEvent(new CustomEvent("creation:receipt", { detail: { key, value } }));
  const remember = (result: CreationReceipt) => {
    setReceipt(result);
    publish(result);
    let persisted = backup?.save(result) ?? false;
    try { if (key) { localStorage.setItem(key, JSON.stringify(result)); persisted = true; } }
    catch { /* The draft can still carry the confirmed result. */ }
    return persisted;
  };
  const finish = (clear: () => boolean) => {
    if (!clear()) return false;
    try { if (key) localStorage.removeItem(key); setReceipt(undefined); publish(); return true; }
    catch { return false; }
  };
  return { receipt, remember, finish };
}
