import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus } from "lucide-react";
import type { QuickAddRequest } from "./QuickAdd";
import { Button } from "./ui";
import "./add-menu.css";

export type AddMenuItem = { label: string; icon: ReactNode; request: QuickAddRequest };

export function AddMenu({ label, ariaLabel, items, disabled, onSelect }: {
  label: string; ariaLabel: string; items: AddMenuItem[]; disabled?: boolean;
  onSelect: (request: QuickAddRequest) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  const focusLast = useRef(false);
  const focusTrigger = () => trigger.current?.querySelector("button")?.focus({ preventScroll: true });

  useLayoutEffect(() => {
    if (!open || disabled) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const panel = menu.current;
      if (!anchor || !panel) return;
      const viewport = window.visualViewport;
      const viewportInset = 16;
      const anchorGap = 8;
      const leftEdge = (viewport?.offsetLeft ?? 0) + viewportInset;
      const topEdge = (viewport?.offsetTop ?? 0) + viewportInset;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 2 * viewportInset;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 2 * viewportInset;
      const below = bottomEdge - anchor.bottom - anchorGap;
      const above = anchor.top - topEdge - anchorGap;
      const upward = below < panel.scrollHeight && above > below;
      const maxHeight = Math.max(80, upward ? above : below);
      const height = Math.min(panel.scrollHeight, maxHeight);
      setPosition({ left: Math.max(leftEdge, Math.min(anchor.right - panel.offsetWidth, rightEdge - panel.offsetWidth)), top: upward ? anchor.top - height - anchorGap : anchor.bottom + anchorGap, maxHeight, visibility: "visible" });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [disabled, open]);

  useLayoutEffect(() => {
    if (!open || disabled || position.visibility !== "visible") return;
    const buttons = menu.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[focusLast.current ? buttons.length - 1 : 0]?.focus({ preventScroll: true });
  }, [disabled, open, position.visibility]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const blur = (event: FocusEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", blur);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", blur); };
  }, [open]);

  return <span ref={trigger} className="context-add-trigger">
    <Button className={`page-add-button${open && !disabled ? " is-active" : ""}`} disabled={disabled} aria-label={ariaLabel} title={label} aria-expanded={open && !disabled} aria-haspopup="menu" aria-controls={open && !disabled ? id : undefined}
      onClick={() => { focusLast.current = false; setOpen((value) => !value); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); focusLast.current = event.key === "ArrowUp"; setOpen(true); }
        if (event.key === "Escape") setOpen(false);
      }}><Plus /><span>{label}</span><ChevronDown className="context-add-chevron" /></Button>
    {open && !disabled ? createPortal(<div ref={menu} id={id} className="context-add-menu" role="menu" aria-label={ariaLabel} style={position} onKeyDown={(event) => {
      const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        if (event.key === "Tab") {
          const controls = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]')).filter((element) => {
            if (menu.current?.contains(element) || element.tabIndex < 0 || element.matches(":disabled") || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
            for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
              const style = getComputedStyle(parent);
              if (style.display === "none" || style.visibility === "hidden") return false;
              if (parent.matches("details:not([open])") && parent.querySelector(":scope > summary") !== element) return false;
            }
            return true;
          });
          const index = controls.indexOf(trigger.current?.querySelector("button") as HTMLElement);
          (controls[index + (event.shiftKey ? -1 : 1)] ?? trigger.current?.querySelector("button"))?.focus();
        } else focusTrigger();
        setOpen(false);
      }
    }}>{items.map((item) => <button key={item.label} type="button" role="menuitem" onClick={() => {
      // The dialog must restore focus to a persistent trigger, not a removed menu item.
      focusTrigger(); setOpen(false); onSelect(item.request);
    }}>{item.icon}<span>{item.label}</span></button>)}</div>, document.body) : null}
  </span>;
}
