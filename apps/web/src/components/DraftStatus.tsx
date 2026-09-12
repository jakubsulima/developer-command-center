import { AlertCircle, Check, Clipboard, LoaderCircle, RotateCcw } from "lucide-react";
import type { DraftSaveStatus } from "../hooks/usePersistentDraft";

export function DraftStatus({ status, errorMessage, onRetry, onCopy, copyLabel = "Kopiuj treść", restored = false, context, compact = false }: { status: DraftSaveStatus; errorMessage?: string; onRetry?: () => void; onCopy?: () => void; copyLabel?: string; restored?: boolean; context?: string; compact?: boolean }) {
  if (status === "idle") return null;
  return <span className={`draft-status draft-status-${status}`} role={status === "error" ? "alert" : "status"}>
    {status === "saving" ? <LoaderCircle className="spin" /> : status === "saved" ? <Check /> : <AlertCircle />}
    {status === "saving" ? "Zapisywanie szkicu…" : status === "saved" ? restored ? `Wznowiono szkic${context ? ` · ${context}` : ""}` : compact ? "Szkic zapisany" : "Szkic zapisany na tym urządzeniu" : errorMessage ?? "Nie udało się zapisać szkicu."}
    {status === "error" && onRetry ? <button type="button" className="draft-status-action" onClick={onRetry}><RotateCcw />Ponów</button> : null}
    {status === "error" && onCopy ? <button type="button" className="draft-status-action" onClick={onCopy}><Clipboard />{copyLabel}</button> : null}
  </span>;
}
