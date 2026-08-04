import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { Button } from "./ui";
import { ActionFeedbackContext, type ActionFeedbackValue, type UndoNoticeInput } from "./action-feedback-context";

interface UndoNotice extends UndoNoticeInput {
  id: string;
  expiresAt: number;
  working: boolean;
  error?: string;
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
      setNotices((current) => [...current, { ...input, id: crypto.randomUUID(), expiresAt: Date.now() + durationMs, working: false }]);
    }
  }), []);

  const dismiss = (id: string) => setNotices((current) => current.filter((notice) => notice.id !== id));
  const undo = async (notice: UndoNotice) => {
    setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, working: true, error: undefined } : item));
    try {
      await notice.undo();
      dismiss(notice.id);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Nie udało się cofnąć operacji.";
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, working: false, error: message, expiresAt: Number.POSITIVE_INFINITY } : item));
    }
  };

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      <div className="undo-stack" aria-live="polite" aria-label="Wyniki operacji">
        {notices.map((notice) => (
          <section className={`undo-notice ${notice.error ? "undo-notice-error" : ""}`} role={notice.error ? "alert" : "status"} key={notice.id}>
            <span className="undo-notice-icon">{notice.error ? <AlertCircle /> : <CheckCircle2 />}</span>
            <span><strong>{notice.message}</strong>{notice.error && <small>Cofnięcie nie powiodło się: {notice.error}</small>}</span>
            <Button variant="ghost" loading={notice.working} onClick={() => void undo(notice)}><RotateCcw />Cofnij</Button>
            <button className="icon-button" aria-label="Zamknij komunikat" onClick={() => dismiss(notice.id)}><X /></button>
          </section>
        ))}
      </div>
    </ActionFeedbackContext.Provider>
  );
}
