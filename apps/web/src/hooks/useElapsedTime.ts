import { useEffect, useState } from "react";
import type { FocusState } from "../domain/types";

export function useElapsedTime(focus: FocusState) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!focus.running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [focus.running]);

  const current = focus.running && focus.startedAt ? Math.floor((now - focus.startedAt) / 1000) : 0;
  return focus.elapsedBeforeStart + current;
}

export function formatDuration(totalSeconds: number) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
