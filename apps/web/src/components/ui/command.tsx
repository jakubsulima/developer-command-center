import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Command({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div role="application" className={cn("grid gap-2", className)}>{children}</div>;
}

export function CommandInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("h-10 w-full rounded-md border border-input bg-secondary px-3 text-sm", props.className)} />;
}

export function CommandList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div role="listbox" className={cn("max-h-72 overflow-y-auto", className)}>{children}</div>;
}

export function CommandItem({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={cn("flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-accent", className)}>{children}</button>;
}
