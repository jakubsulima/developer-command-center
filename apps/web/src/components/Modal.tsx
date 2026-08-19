import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { DialogContent } from "./ui/dialog";

export function Modal({ open, title, onClose, children, role = "dialog", closeOnBackdrop = true, closeDisabled = false, className, backdropClassName, initialFocus = "first", exitDurationMs = 0 }: { open: boolean; title: string; onClose: () => void; children: ReactNode; role?: "dialog" | "alertdialog"; closeOnBackdrop?: boolean; closeDisabled?: boolean; className?: string; backdropClassName?: string; initialFocus?: "first" | "input"; exitDurationMs?: number }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  const titleId = useId();
  onCloseRef.current = onClose;
  useEffect(() => {
    if (open) {
      setPresent(true);
      setClosing(false);
      return;
    }
    if (!present || exitDurationMs <= 0) {
      setPresent(false);
      setClosing(false);
      return;
    }
    setClosing(true);
    const timeout = window.setTimeout(() => {
      setPresent(false);
      setClosing(false);
    }, exitDurationMs);
    return () => window.clearTimeout(timeout);
  }, [exitDurationMs, open, present]);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (closeOnBackdrop && !closeDisabled) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handler);
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(document.activeElement)) return;
      const preferred = initialFocus === "input" ? dialog.querySelector<HTMLElement>('input:not([disabled])') : null;
      (preferred ?? dialog.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'))?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handler);
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      previousFocus?.focus();
    };
  }, [closeDisabled, closeOnBackdrop, initialFocus, open]);

  if (exitDurationMs > 0 ? !present : !open) return null;
  return (
    <div className={`modal-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}${closing ? " modal-backdrop-closing" : ""}`} role="presentation" aria-hidden={closing || undefined} onFocusCapture={(event) => {
      if (!previousFocusRef.current && event.relatedTarget instanceof HTMLElement && !event.currentTarget.contains(event.relatedTarget)) previousFocusRef.current = event.relatedTarget;
    }} onMouseDown={(event) => event.target === event.currentTarget && closeOnBackdrop && !closeDisabled && onClose()}>
      <DialogContent ref={dialogRef} className={`modal${className ? ` ${className}` : ""}`} role={role} aria-modal="true" aria-labelledby={titleId} showClose={false}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" disabled={closeDisabled} onClick={onClose} aria-label="Zamknij okno"><X /></button>
        </div>
        {children}
      </DialogContent>
    </div>
  );
}
