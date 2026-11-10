import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowUpRight, Check, RotateCcw, X } from "lucide-react";
import { Button } from "./ui";
import { ActionFeedbackContext, type ActionFeedbackValue, type UndoNoticeInput } from "./action-feedback-context";
import { describeMutationError } from "../lib/mutationError";
import "./action-feedback.css";

const EXIT_DURATION_MS = 240;

interface UndoNotice extends UndoNoticeInput {
  id: string;
  expiresAt: number;
  durationMs: number;
  dismissedAt?: number;
  working: boolean;
  error?: string;
  kind: "undo" | "success" | "error";
}

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const interacting = useRef(new Set<string>());
  const lastTick = useRef(Date.now());
  const [now, setNow] = useState(Date.now);
  const [notices, setNotices] = useState<UndoNotice[]>([]);

  useEffect(() => {
    if (!notices.length) return;
    lastTick.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTick.current;
      lastTick.current = now;
      setNow(now);
      setNotices((current) => current.flatMap((notice) => {
        if (notice.dismissedAt !== undefined) {
          if (now - notice.dismissedAt < EXIT_DURATION_MS) return [notice];
          return [];
        }
        if (notice.error || notice.kind === "error") return [notice];
        if (notice.working || interacting.current.has(notice.id)) return [{ ...notice, expiresAt: notice.expiresAt + elapsed }];
        return [notice.expiresAt > now ? notice : { ...notice, dismissedAt: now }];
      }));
    }, 100);
    return () => window.clearInterval(timer);
  }, [notices.length]);

  const value = useMemo<ActionFeedbackValue>(() => ({
    notifyUndo(input) {
      const durationMs = input.durationMs ?? 8_000;
      setNotices((current) => [...current, { ...input, durationMs, kind: "undo", id: crypto.randomUUID(), expiresAt: Date.now() + durationMs, working: false }]);
    },
    notifySuccess(message, action) {
      const durationMs = action ? 12_000 : 5_000;
      setNotices((current) => [...current, { message, action, durationMs, undo: () => undefined, kind: "success", id: crypto.randomUUID(), expiresAt: Date.now() + durationMs, working: false }]);
    },
    notifyError(message) {
      setNotices((current) => [...current, { message, durationMs: 0, undo: () => undefined, kind: "error", id: crypto.randomUUID(), expiresAt: Number.POSITIVE_INFINITY, working: false }]);
    }
  }), []);

  const dismiss = (id: string) => {
    interacting.current.delete(id);
    setNotices((current) => current.map((notice) => notice.id === id && notice.dismissedAt === undefined ? { ...notice, dismissedAt: Date.now() } : notice));
  };
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
        {notices.map((notice) => {
          const isError = Boolean(notice.error || notice.kind === "error");
          const remaining = Math.max(0, Math.min(1, (notice.expiresAt - now) / Math.max(1, notice.durationMs)));
          return (
            <div className="undo-notice-slot" data-leaving={notice.dismissedAt !== undefined || undefined} inert={notice.dismissedAt !== undefined} key={notice.id}>
              <div className="undo-notice-clip">
                <section
                  className={`undo-notice ${isError ? "undo-notice-error" : ""}`}
                  role={isError ? "alert" : "status"}
                  onPointerEnter={() => interacting.current.add(notice.id)}
                  onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) interacting.current.delete(notice.id); }}
                  onFocus={() => interacting.current.add(notice.id)}
                  onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(":hover")) interacting.current.delete(notice.id); }}
                >
                  <span className="undo-notice-icon" aria-hidden="true">{isError ? <AlertCircle /> : <Check />}</span>
                  <div className="undo-notice-copy">
                    <span className="undo-notice-label">{isError ? "Wymaga uwagi" : notice.kind === "undo" ? "Zmiana zapisana" : "Gotowe"}</span>
                    <strong>{notice.message}</strong>
                    {notice.error && <small>Cofnięcie nie powiodło się: {notice.error}</small>}
                  </div>
                  {notice.kind === "undo" || notice.action ? <div className="undo-notice-actions">
                    {notice.kind === "undo" ? <Button variant="ghost" loading={notice.working} onClick={() => void undo(notice)}><RotateCcw aria-hidden="true" />Cofnij</Button> : null}
                    {notice.action ? <Button variant="ghost" onClick={() => { void notice.action?.onClick(); dismiss(notice.id); }}>{notice.action.label}<ArrowUpRight aria-hidden="true" /></Button> : null}
                  </div> : null}
                  <button type="button" className="icon-button undo-notice-close" aria-label="Zamknij komunikat" onClick={() => dismiss(notice.id)}><X aria-hidden="true" /></button>
                  {!isError ? <span className="undo-notice-progress" aria-hidden="true"><span style={{ transform: `scaleX(${remaining})` }} /></span> : null}
                </section>
              </div>
            </div>
          );
        })}
      </div>
    </ActionFeedbackContext.Provider>
  );
}
