import { useSyncExternalStore } from "react";

const query = "(min-width: 1200px)";
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function useDesktopLayout() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
