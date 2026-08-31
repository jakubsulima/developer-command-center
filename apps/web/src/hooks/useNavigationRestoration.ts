import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  clearNavigationRestore,
  locationAddress,
  readNavigationRestore,
  readNavigationState
} from "../domain/navigation";

export function useNavigationRestoration() {
  const location = useLocation();
  const restored = useRef<string | undefined>(undefined);

  useEffect(() => {
    const address = locationAddress(location);
    const navigation = readNavigationState(location.state);
    const savedFromHistory = readNavigationRestore(address);
    const restoreState = location.state && typeof location.state === "object" ? (location.state as { navigationRestore?: unknown }).navigationRestore : undefined;
    const savedFromReturn = restoreState && typeof restoreState === "object"
      ? { sourceCardId: typeof (restoreState as { sourceCardId?: unknown }).sourceCardId === "string" ? (restoreState as { sourceCardId: string }).sourceCardId : undefined, scrollY: typeof (restoreState as { scrollY?: unknown }).scrollY === "number" ? (restoreState as { scrollY: number }).scrollY : undefined }
      : undefined;
    const targetIsCurrentPage = navigation?.sourceCardId
      ? Boolean(document.querySelector(`[data-navigation-card-id="${CSS.escape(navigation.sourceCardId)}"]`))
      : false;
    const navigationIsReturn = navigation?.returnTo === address;
    const saved = savedFromHistory ?? savedFromReturn ?? ((navigationIsReturn || targetIsCurrentPage) && navigation
      ? { sourceCardId: navigation.sourceCardId, scrollY: navigation.scrollY }
      : undefined);
    if (!saved || restored.current === address) return;
    restored.current = address;

    let timeout: number | undefined;
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (saved.scrollY !== undefined) window.scrollTo({ top: saved.scrollY, left: 0, behavior: "auto" });
        const target = saved.sourceCardId ? document.querySelector<HTMLElement>(`[data-navigation-card-id="${CSS.escape(saved.sourceCardId)}"]`) : null;
        if (target) {
          target.focus({ preventScroll: true });
          target.classList.add("navigation-card-highlight");
          timeout = window.setTimeout(() => target.classList.remove("navigation-card-highlight"), 1400);
        }
        clearNavigationRestore(address);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [location]);
}
