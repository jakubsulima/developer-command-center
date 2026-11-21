import { createContext, useContext, useLayoutEffect, useRef, type RefObject } from "react";

interface NavFrame {
  nav: HTMLElement;
  width: number;
  height: number;
  labelHeight: number;
  labelOpacity: string;
}

export interface MobileNavPosition {
  activeIndex?: number;
  outgoingFrame?: NavFrame;
}

// Route pages render separate shells, so pass their last visible nav state through App.
export const MobileNavPositionContext = createContext<RefObject<MobileNavPosition> | null>(null);

const motion = { duration: 280, easing: "cubic-bezier(.2, .8, .2, 1)" };

function canAnimateMobileNav() {
  return window.matchMedia("(max-width: 767px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readFrame(nav: HTMLElement, label: HTMLElement): NavFrame {
  const { width, height } = nav.getBoundingClientRect();
  return { nav, width, height, labelHeight: label.getBoundingClientRect().height, labelOpacity: getComputedStyle(label).opacity };
}

export function useMobileNavIndicator(loading: boolean, pathname: string, aiReviewActive: boolean) {
  const position = useContext(MobileNavPositionContext);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const nav = indicator?.parentElement;
    if (!indicator || !nav) return;

    const activeIndex = Array.from(nav.children).findIndex((item) => item.getAttribute("aria-current") === "page");
    const previousIndex = position?.current.activeIndex;
    if (position) position.current.activeIndex = activeIndex;
    if (activeIndex < 0) return;

    indicator.style.transform = `translateX(${activeIndex * 100}%)`;
    if (previousIndex === undefined || previousIndex < 0 || previousIndex === activeIndex || !canAnimateMobileNav()) return;

    indicator.animate?.([
      { transform: `translateX(${previousIndex * 100}%)` },
      { transform: indicator.style.transform },
    ], motion);
  }, [loading, pathname, aiReviewActive, position]);

  useLayoutEffect(() => {
    const nav = indicatorRef.current?.parentElement;
    const labels = nav?.querySelectorAll<HTMLElement>(".bottom-nav-label");
    const firstLabel = labels?.[0];
    const navPosition = position?.current;
    if (!nav || !labels || !firstLabel || !navPosition) return;

    const previous = navPosition.outgoingFrame;
    navPosition.outgoingFrame = undefined;
    if (previous && previous.nav !== nav && canAnimateMobileNav()) {
      const size = readFrame(nav, firstLabel);
      if (previous.width !== size.width || previous.height !== size.height) {
        nav.animate?.([{ width: `${previous.width}px`, height: `${previous.height}px` }, {}], motion);
      }
      if (previous.labelHeight !== size.labelHeight || previous.labelOpacity !== size.labelOpacity) {
        labels.forEach((label) => {
          label.animate?.([{ maxHeight: `${previous.labelHeight}px`, opacity: previous.labelOpacity }, {}], motion);
        });
      }
    }

    return () => {
      if (!canAnimateMobileNav()) return;
      const frame = readFrame(nav, firstLabel);
      if (frame.width > 0) navPosition.outgoingFrame = frame;
    };
  }, [loading, position]);

  return indicatorRef;
}
