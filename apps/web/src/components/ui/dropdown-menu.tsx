import type { ReactNode } from "react";

export function DropdownMenu({ children }: { children: ReactNode }) {
  return <details className="dropdown-menu">{children}</details>;
}

export function DropdownMenuTrigger({ children }: { children: ReactNode }) {
  return <summary>{children}</summary>;
}

export function DropdownMenuContent({ children }: { children: ReactNode }) {
  return <div className="dropdown-menu-content">{children}</div>;
}

export function DropdownMenuItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return <button type="button" onClick={onSelect}>{children}</button>;
}
