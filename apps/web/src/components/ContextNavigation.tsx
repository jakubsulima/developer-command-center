import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link, useLocation, useNavigate, type LinkProps } from "react-router-dom";
import {
  breadcrumbsForPage,
  rememberNavigationState,
  readNavigationBreadcrumbs,
  readNavigationState,
  type NavigationBreadcrumb,
  type NavigationState
} from "../domain/navigation";

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

function navigationStateForChild({ breadcrumbs, returnTo, returnLabel, sourceCardId }: {
  breadcrumbs: NavigationBreadcrumb[];
  returnTo: string;
  returnLabel: string;
  sourceCardId?: string;
}): NavigationState {
  return { breadcrumbs, returnTo, returnLabel, sourceCardId, scrollY: typeof window === "undefined" ? undefined : window.scrollY };
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
