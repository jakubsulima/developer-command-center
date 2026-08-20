import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Resetuje pozycję tylko przy wejściu w nowy ekran; POP zostawia natywne odtworzenie historii. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;
    if (window.scrollY > 0) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [navigationType, pathname]);

  return null;
}
