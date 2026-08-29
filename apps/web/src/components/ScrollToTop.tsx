import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Resetuje pozycję tylko przy wejściu w nowy ekran; POP zostawia natywne odtworzenie historii. */
export function ScrollToTop() {
  const location = useLocation();
  const { pathname } = location;
  const navigationType = useNavigationType();

  useEffect(() => {
    const hasNavigationRestore = Boolean(location.state && typeof location.state === "object" && "navigationRestore" in location.state);
    if (navigationType === "POP" || hasNavigationRestore) return;
    if (window.scrollY > 0) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.state, navigationType, pathname]);

  return null;
}
