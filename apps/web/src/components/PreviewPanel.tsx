import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function PreviewPanel({ id, label, title, focusKey, className, onClose, children }: {
  id: string;
  label: string;
  title: string;
  focusKey: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (window.matchMedia("(min-width: 1440px)").matches) headingRef.current?.focus({ preventScroll: true });
  }, [focusKey]);

  return <aside className={`desktop-preview ${className}`} id={id} aria-labelledby={`${id}-title`}>
    <div className="desktop-preview-toolbar"><span>{label}</span><button type="button" className="icon-button" aria-label={`Zamknij ${label[0].toLocaleLowerCase("pl")}${label.slice(1)}`} title="Zamknij podgląd (Esc)" onClick={onClose}><X aria-hidden="true" /></button></div>
    <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{title}</h2>
    {children}
  </aside>;
}
