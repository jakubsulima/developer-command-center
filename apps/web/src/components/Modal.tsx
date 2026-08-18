import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, title, onClose, children, role = "dialog", closeOnBackdrop = true, closeDisabled = false, className, initialFocus = "first" }: { open: boolean; title: string; onClose: () => void; children: ReactNode; role?: "dialog" | "alertdialog"; closeOnBackdrop?: boolean; closeDisabled?: boolean; className?: string; initialFocus?: "first" | "input" }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;
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

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onFocusCapture={(event) => {
      if (!previousFocusRef.current && event.relatedTarget instanceof HTMLElement && !event.currentTarget.contains(event.relatedTarget)) previousFocusRef.current = event.relatedTarget;
    }} onMouseDown={(event) => event.target === event.currentTarget && closeOnBackdrop && !closeDisabled && onClose()}>
      <div ref={dialogRef} className={`modal${className ? ` ${className}` : ""}`} role={role} aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" disabled={closeDisabled} onClick={onClose} aria-label="Zamknij okno"><X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
