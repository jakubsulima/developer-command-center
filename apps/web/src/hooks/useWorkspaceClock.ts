import { useEffect, useState } from "react";

/** Keeps calendar projections current even when the tab stays open overnight. */
export function useWorkspaceClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, []);
  return now;
}
