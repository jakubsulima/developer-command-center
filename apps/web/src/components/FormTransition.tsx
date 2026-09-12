import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Animate changing fields without remounting inputs or moving their focus. */
export function FormTransition({ stateKey, children, className = "" }: { stateKey: string; children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const animation = element.animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
    return () => animation.cancel();
  }, [stateKey]);
  return <div ref={root} className={`form-transition ${className}`}>{children}</div>;
}
