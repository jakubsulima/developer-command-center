import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  void onOpenChange;
  if (!open) return null;
  return <div data-state="open">{children}</div>;
}

export function DialogOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fixed inset-0 z-50 bg-black/75 backdrop-blur-sm", className)} {...props} />;
}

export const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void; showClose?: boolean }>(({ className, children, onClose, showClose = true, ...props }, ref) => (
  <div ref={ref} className={cn("relative w-full max-w-lg rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl", className)} {...props}>
    {children}
    {showClose && onClose ? <button type="button" className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClose} aria-label="Zamknij okno"><X className="size-4" /></button> : null}
  </div>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />; }
export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />; }
export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn("text-sm text-muted-foreground", className)} {...props} />; }
