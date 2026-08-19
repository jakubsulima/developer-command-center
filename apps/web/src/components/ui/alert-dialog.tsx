import * as React from "react";
import { cn } from "@/lib/utils";

export function AlertDialog({ open, children }: { open: boolean; children: React.ReactNode }) { return open ? <div data-alert-dialog="open">{children}</div> : null; }
export function AlertDialogOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("fixed inset-0 z-50 bg-black/75 backdrop-blur-sm", className)} {...props} />; }
export const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} role="alertdialog" aria-modal="true" className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl", className)} {...props} />);
AlertDialogContent.displayName = "AlertDialogContent";
export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex flex-col gap-2 text-left", className)} {...props} />; }
export function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn("text-lg font-semibold", className)} {...props} />; }
export function AlertDialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn("text-sm text-muted-foreground", className)} {...props} />; }
export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />; }
