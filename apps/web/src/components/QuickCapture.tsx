import { Zap } from "lucide-react";
import { useStore } from "../app/useStore";
import { Panel } from "./ui";
import { CaptureComposer } from "./CaptureComposer";

export function QuickCapture({ compact = false }: { compact?: boolean }) {
  const { capture } = useStore();
  return (
    <Panel className={`quick-capture ${compact ? "capture-compact" : ""}`}>
      {!compact && <h2 className="panel-title"><Zap className="text-info" />Szybkie przechwycenie</h2>}
      <CaptureComposer draftKey={compact ? "quick-capture-compact" : "quick-capture"} id={compact ? "quick-capture-compact" : "quick-capture"} compact={compact} onSubmit={capture} />
    </Panel>
  );
}
