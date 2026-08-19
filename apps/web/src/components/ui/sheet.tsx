import type { ReactNode } from "react";
import { Modal } from "../Modal";
import { mobileSheetVariants } from "../ui-variants";

/** Bottom sheet sharing Modal's focus trap, Escape handling and focus restoration. */
export function Sheet({ open, title, onOpenChange, children, className = "" }: {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return <Modal open={open} title={title} onClose={() => onOpenChange(false)} className={`${mobileSheetVariants({ side: "bottom" })} sheet-content ${className}`} backdropClassName="sheet-backdrop">{children}</Modal>;
}
