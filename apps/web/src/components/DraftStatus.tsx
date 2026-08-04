import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import type { DraftSaveStatus } from "../hooks/usePersistentDraft";

export function DraftStatus({ status }: { status: DraftSaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className={`draft-status draft-status-${status}`} role={status === "error" ? "alert" : "status"}>
      {status === "saving" ? <LoaderCircle className="spin" /> : status === "saved" ? <Check /> : <AlertCircle />}
      {status === "saving" ? "Zapisywanie…" : status === "saved" ? "Wersja robocza zapisana" : "Nie udało się zapisać wersji roboczej"}
    </span>
  );
}
