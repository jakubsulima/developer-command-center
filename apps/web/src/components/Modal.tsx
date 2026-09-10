import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { DialogContent } from "./ui/dialog";

type InitialFocus = "first" | "input" | "none";

type ViewportMetrics = { height: number; offsetTop: number };

function readViewportMetrics(): ViewportMetrics {
  const viewport = window.visualViewport;
  return {
    height: Math.round(viewport?.height ?? window.innerHeight),
    offsetTop: Math.round(viewport?.offsetTop ?? 0)
  };
}

function isFocusable(element: HTMLElement) {
  if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("details:not([open])")) return false;
  let current: HTMLElement | null = element;
  while (current) {
    if (current.hasAttribute("hidden") || current.getAttribute("aria-hidden") === "true") return false;
    const styles = window.getComputedStyle(current);
    if (styles.display === "none" || styles.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

export function Modal({ open, title, ariaLabel, onClose, children, role = "dialog", closeOnBackdrop = true, closeDisabled = false, className, backdropClassName, initialFocus = "first", exitDurationMs = 0 }: { open: boolean; title: string; ariaLabel?: string; onClose: () => void; children: ReactNode; role?: "dialog" | "alertdialog"; closeOnBackdrop?: boolean; closeDisabled?: boolean; className?: string; backdropClassName?: string; initialFocus?: InitialFocus; exitDurationMs?: number }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  const [viewportMetrics, setViewportMetrics] = useState<ViewportMetrics>(() => readViewportMetrics());
  const closeDisabledRef = useRef(closeDisabled);
  const titleId = useId();
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    const inerted: Array<{ element: HTMLElement; value: boolean }> = [];
    const backdrop = document.querySelector<HTMLElement>("[data-modal-backdrop]:not(.modal-backdrop-closing)");
    const parent = backdrop?.parentElement;
    for (const element of parent ? Array.from(parent.children) : []) {
      if (element instanceof HTMLElement && element !== backdrop && !element.matches("[data-modal-backdrop]")) {
        inerted.push({ element, value: element.inert });
        element.inert = true;
      }
    }
    const viewport = window.visualViewport;
    const updateViewport = () => setViewportMetrics(readViewportMetrics());
    updateViewport();
    window.addEventListener("resize", updateViewport);
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      inerted.forEach(({ element, value }) => { element.inert = value; });
      if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
      window.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
    };
  }, [open]);
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
        if (closeOnBackdrop && !closeDisabledRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])')].filter(isFocusable);
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
      if (initialFocus === "none") return;
      // Prefer the interaction model over a width breakpoint. The narrow
      // fallback covers embedded mobile browsers that do not expose pointer
      // capabilities to automation or standalone webviews.
      const isTouchViewport = navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth <= 767;
      if (isTouchViewport) {
        dialog.focus();
        return;
      }
      const preferred = initialFocus === "input" ? dialog.querySelector<HTMLElement>('input:not([disabled])') : null;
      const field = [...dialog.querySelectorAll<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')].find(isFocusable);
      const fallback = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], summary, [tabindex]:not([tabindex="-1"])')].find(isFocusable);
      (preferred && isFocusable(preferred) ? preferred : field ?? fallback)?.focus();
      if (!preferred && !field && !fallback) dialog.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handler);
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      previousFocus?.focus();
    };
  }, [closeOnBackdrop, initialFocus, open]);

  if (exitDurationMs > 0 ? !present : !open) return null;
  return (
    <div data-modal-backdrop className={`modal-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}${closing ? " modal-backdrop-closing" : ""}`} role="presentation" aria-hidden={closing || undefined} style={{ "--modal-viewport-height": `${viewportMetrics.height}px`, "--modal-viewport-offset-top": `${viewportMetrics.offsetTop}px` } as CSSProperties} onFocusCapture={(event) => {
      if (!previousFocusRef.current && event.relatedTarget instanceof HTMLElement && !event.currentTarget.contains(event.relatedTarget)) previousFocusRef.current = event.relatedTarget;
    }} onMouseDown={(event) => event.target === event.currentTarget && closeOnBackdrop && !closeDisabled && onClose()}>
      <DialogContent ref={dialogRef} tabIndex={-1} className={`modal${className ? ` ${className}` : ""}`} role={role} aria-modal="true" {...(ariaLabel ? { "aria-label": ariaLabel } : { "aria-labelledby": titleId })} showClose={false}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" disabled={closeDisabled} onClick={onClose} aria-label="Zamknij okno"><X /></button>
        </div>
        {children}
      </DialogContent>
    </div>
  );
}
