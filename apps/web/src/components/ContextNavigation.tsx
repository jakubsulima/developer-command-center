import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link, useLocation, useNavigate, type LinkProps } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  breadcrumbsForPage,
  clearNavigationRestore,
  locationAddress,
  rememberNavigationState,
  readNavigationBreadcrumbs,
  readNavigationRestore,
  readNavigationState,
  type NavigationBreadcrumb,
  type NavigationState
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

export function ContextNavigation({ current, fallbackBreadcrumbs, fallbackReturnTo, fallbackReturnLabel }: {
  current: NavigationBreadcrumb;
  fallbackBreadcrumbs: NavigationBreadcrumb[];
  fallbackReturnTo: string;
  fallbackReturnLabel: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = readNavigationState(location.state);
  const parentBreadcrumbs = readNavigationBreadcrumbs(location.state);
  const breadcrumbs = breadcrumbsForPage(location.state, fallbackBreadcrumbs, current);
  const visible = breadcrumbs.length > 3 ? [{ label: "…" }, ...breadcrumbs.slice(-3)] : breadcrumbs;
  const nestedParent = parentBreadcrumbs && parentBreadcrumbs.length > 1 ? parentBreadcrumbs.at(-2) : undefined;
  const returnTo = navigation?.returnTo ?? nestedParent?.to ?? fallbackReturnTo;
  const returnLabel = navigation?.returnLabel ?? nestedParent?.label ?? fallbackReturnLabel;

  const goBack = () => navigate(returnTo, navigation ? { state: { navigationRestore: { sourceCardId: navigation.sourceCardId, scrollY: navigation.scrollY }, breadcrumbs: navigation.breadcrumbs } } : undefined);

  return <nav className="context-navigation" aria-label="Ścieżka kontekstu">
    <button className="back-link context-navigation-back" type="button" onClick={goBack} aria-label={returnLabel}><ArrowLeft /><span>{returnLabel}</span></button>
    <ol className="context-breadcrumbs">
      {visible.map((breadcrumb, index) => {
        const isCurrent = index === visible.length - 1;
        const isEllipsis = breadcrumb.label === "…";
        return <li key={`${breadcrumb.label}-${index}`}>
          {index > 0 ? <ChevronRight aria-hidden="true" /> : null}
              {isEllipsis ? <span className="context-breadcrumb-ellipsis" aria-label="Pominięte poziomy">…</span> : isCurrent || !breadcrumb.to ? <span aria-current={isCurrent ? "page" : undefined}>{breadcrumb.label}</span> : <Link to={breadcrumb.to} state={{ breadcrumbs: breadcrumbs.slice(0, index + 1), navigationRestore: navigation ? { sourceCardId: navigation.sourceCardId, scrollY: navigation.scrollY } : undefined }}>{breadcrumb.label}</Link>}
        </li>;
      })}
    </ol>
  </nav>;
}

export function navigationStateForChild({ breadcrumbs, returnTo, returnLabel, sourceCardId }: {
  breadcrumbs: NavigationBreadcrumb[];
  returnTo: string;
  returnLabel: string;
  sourceCardId?: string;
}): NavigationState {
  return { breadcrumbs, returnTo, returnLabel, sourceCardId, scrollY: typeof window === "undefined" ? undefined : window.scrollY };
}

export function useContextBreadcrumbs(fallback: NavigationBreadcrumb[], current: NavigationBreadcrumb) {
  const location = useLocation();
  return breadcrumbsForPage(location.state, fallback, current);
}


export function NavigationLink({ to, breadcrumbs, returnTo, returnLabel, sourceCardId, children, onClick, ...props }: Omit<LinkProps, "to"> & {
  to: string;
  breadcrumbs: NavigationBreadcrumb[];
  returnTo: string;
  returnLabel: string;
  sourceCardId?: string;
}) {
  const navigate = useNavigate();
  return <Link {...props} to={to} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const state = navigationStateForChild({ breadcrumbs, returnTo, returnLabel, sourceCardId });
    rememberNavigationState(state);
    navigate(to, { state });
  }}>{children}</Link>;
}
