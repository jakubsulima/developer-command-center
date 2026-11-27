import { TerminalSquare } from "lucide-react";

export function CommandBrand({ compact = false }: { compact?: boolean }) {
  return <><span className="brand-mark"><TerminalSquare aria-hidden="true" /></span>{compact ? null : <span>Command</span>}</>;
}
