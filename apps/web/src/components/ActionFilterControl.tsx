import type { ReactNode, Ref } from "react";
import { Check, Filter } from "lucide-react";
import { Modal } from "./Modal";
import "./action-filter-control.css";

export function ActionFilterControl({ label, ariaLabel, count, dialogTitle = "Filtry Działań", active, open, onOpenChange, children, footer, inline = false, triggerRef }: {
  label: string;
  ariaLabel: string;
  count?: number;
  dialogTitle?: string;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  inline?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  return <>
    <button ref={triggerRef} className={`action-filter-trigger${inline ? " action-filter-trigger-inline" : ""}`} type="button" aria-label={ariaLabel} title={ariaLabel} aria-haspopup="dialog" aria-expanded={open} data-filtered={active} onClick={() => onOpenChange(true)}>
      <Filter aria-hidden="true" />
      <span className="action-filter-trigger-label">{label}</span>
      {active ? <span className="action-filter-indicator" aria-hidden="true">{count ? <span>{count}</span> : <Check />}</span> : null}
    </button>
    <Modal open={open} onClose={() => onOpenChange(false)} title={dialogTitle} className="action-filter-dialog">
      <div className="action-filter-groups" data-modal-scroll-body>{children}</div>
      {footer ? <div className="action-filter-footer">{footer}</div> : null}
    </Modal>
  </>;
}
