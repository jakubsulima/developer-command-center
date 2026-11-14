import { useLayoutEffect, useState } from "react";

/** Require room for the work list and context after the sidebar is subtracted. */
export function useProjectLayout() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [hasRoom, setHasRoom] = useState(typeof ResizeObserver === "undefined");
  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => setHasRoom(element.getBoundingClientRect().width >= 820);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, hasRoom] as const;
}
