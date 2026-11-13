import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { CreationDialog } from "./CreationForm";

/** The same editor stays in a desktop column or the existing mobile dialog. */
export function InboxProcessingSurface({ desktop, open, title, busy, focusKey, onClose, idle, children }: {
  desktop: boolean;
  open: boolean;
  title: string;
  busy: boolean;
  focusKey: string;
  onClose: () => void;
  idle: ReactNode;
  children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (desktop && focusKey) headingRef.current?.focus({ preventScroll: true });
  }, [desktop, focusKey]);

  if (!desktop) return <CreationDialog open={open} closeDisabled={busy} title={title} onClose={onClose}>{children}</CreationDialog>;
  return <aside className="inbox-processing-panel creation-dialog" id="inbox-processing-panel" aria-label="Przetwarzanie wpisu" aria-busy={busy}>
    <header className="inbox-processing-heading"><div><span>Skrzynka</span><h2 ref={headingRef} tabIndex={-1}>{open ? title : "Przetwarzanie wpisu"}</h2></div>{focusKey ? <button type="button" className="icon-button" aria-label="Zamknij przetwarzanie wpisu" title="Zamknij (Esc)" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button> : null}</header>
    {open ? children : idle}
  </aside>;
}
