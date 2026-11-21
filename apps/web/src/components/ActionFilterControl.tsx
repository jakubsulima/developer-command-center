import type { ReactNode } from "react";
import { Check, Filter } from "lucide-react";
import { Modal } from "./Modal";
import "./action-filter-control.css";

export function ActionFilterControl({ label, ariaLabel, active, open, onOpenChange, children, footer }: {
  label: string;
  ariaLabel: string;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return <>
    <button className="action-filter-trigger" type="button" aria-label={ariaLabel} title={ariaLabel} aria-haspopup="dialog" aria-expanded={open} data-filtered={active} onClick={() => onOpenChange(true)}>
      <Filter aria-hidden="true" />
      <span className="action-filter-trigger-label">{label}</span>
      {active ? <span className="action-filter-indicator" aria-hidden="true"><Check /></span> : null}
    </button>
    <Modal open={open} onClose={() => onOpenChange(false)} title="Filtry Działań" className="action-filter-dialog">
      <div className="action-filter-groups" data-modal-scroll-body>{children}</div>
      {footer ? <div className="action-filter-footer">{footer}</div> : null}
    </Modal>
  </>;
}
