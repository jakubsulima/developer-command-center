import { useState } from "react";
import { ArrowUp, Zap } from "lucide-react";
import { useStore } from "../app/useStore";
import { Panel } from "./ui";

export function QuickCapture({ compact = false }: { compact?: boolean }) {
  const { capture } = useStore();
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim()) return;
    capture(value);
    setValue("");
  };

  return (
    <Panel className={`quick-capture ${compact ? "capture-compact" : ""}`}>
      {!compact && <h2 className="panel-title"><Zap className="text-info" />Szybkie przechwycenie</h2>}
      <label className="sr-only" htmlFor={compact ? "quick-capture-compact" : "quick-capture"}>Zapisz myśl, zadanie lub link</label>
      <textarea
        id={compact ? "quick-capture-compact" : "quick-capture"}
        rows={compact ? 2 : 3}
        placeholder="Zapisz myśl, zadanie lub link…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
        }}
      />
      <div className="capture-toolbar">
        <small>⌘/Ctrl + Enter</small>
        <button className="capture-submit" aria-label="Zapisz przechwycenie" onClick={submit} disabled={!value.trim()}><ArrowUp /></button>
      </div>
    </Panel>
  );
}
