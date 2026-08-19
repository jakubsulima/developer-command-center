import type { ReactNode } from "react";

export function Collapsible({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <details className={className}>{children}</details>;
}

export function CollapsibleTrigger({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <summary className={className}>{children}</summary>;
}

export function CollapsibleContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
