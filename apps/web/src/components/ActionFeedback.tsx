import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { Button } from "./ui";
import { ActionFeedbackContext, type ActionFeedbackValue, type UndoNoticeInput } from "./action-feedback-context";
import { describeMutationError } from "../lib/mutationError";

interface UndoNotice extends UndoNoticeInput {
  id: string;
  expiresAt: number;
  working: boolean;
  error?: string;
  kind: "undo" | "success" | "error";
}

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<UndoNotice[]>([]);

  useEffect(() => {
    if (!notices.length) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNotices((current) => current.filter((notice) => notice.working || notice.error || notice.expiresAt > now));
    }, 250);
    return () => window.clearInterval(timer);
  }, [notices.length]);

  const value = useMemo<ActionFeedbackValue>(() => ({
    notifyUndo(input) {
      const durationMs = input.durationMs ?? 8_000;
      setNotices((current) => [...current, { ...input, kind: "undo", id: crypto.randomUUID(), expiresAt: Date.now() + durationMs, working: false }]);
    },
    notifySuccess(message) {
      setNotices((current) => [...current, { message, undo: () => undefined, kind: "success", id: crypto.randomUUID(), expiresAt: Date.now() + 5_000, working: false }]);
    },
    notifyError(message) {
      setNotices((current) => [...current, { message, undo: () => undefined, kind: "error", id: crypto.randomUUID(), expiresAt: Date.now() + 8_000, working: false }]);
    }
  }), []);

  const dismiss = (id: string) => setNotices((current) => current.filter((notice) => notice.id !== id));
  const undo = async (notice: UndoNotice) => {
    setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, working: true, error: undefined } : item));
    try {
      await notice.undo();
      dismiss(notice.id);
    } catch (caught) {
      const message = describeMutationError(caught, "Nie udało się cofnąć operacji.");
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, working: false, error: message, expiresAt: Number.POSITIVE_INFINITY } : item));
    }
  };

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      <div className="undo-stack" aria-live="polite" aria-label="Wyniki operacji">
        {notices.map((notice) => (
          <section className={`undo-notice ${notice.error || notice.kind === "error" ? "undo-notice-error" : ""}`} role={notice.error || notice.kind === "error" ? "alert" : "status"} key={notice.id}>
            <span className="undo-notice-icon">{notice.error || notice.kind === "error" ? <AlertCircle /> : <CheckCircle2 />}</span>
            <span><strong>{notice.message}</strong>{notice.error && <small>Cofnięcie nie powiodło się: {notice.error}</small>}</span>
            {notice.kind === "undo" ? <Button variant="ghost" loading={notice.working} onClick={() => void undo(notice)}><RotateCcw />Cofnij</Button> : null}
            {notice.action ? <Button variant="ghost" onClick={() => { void notice.action?.onClick(); dismiss(notice.id); }}>{notice.action.label}</Button> : null}
            <button className="icon-button" aria-label="Zamknij komunikat" onClick={() => dismiss(notice.id)}><X /></button>
          </section>
        ))}
      </div>
    </ActionFeedbackContext.Provider>
  );
}
