import type { ComponentProps, ReactNode } from "react";
import { Modal } from "./Modal";
import "./creation-form.css";

/** The shell owns geometry; each domain form keeps its own save operation. */
export function CreationDialog({ className = "", ...props }: ComponentProps<typeof Modal>) {
  return <Modal {...props} className={`creation-hub-modal creation-dialog ${className}`} backdropClassName="quick-add-backdrop" exitDurationMs={160} />;
}

export function CreationBody({ children }: { children: ReactNode }) {
  return <div className="quick-add-body" data-modal-scroll-body>{children}</div>;
}

export function CreationFooter({ children }: { children: ReactNode }) {
  return <div className="quick-add-footer">{children}</div>;
}
