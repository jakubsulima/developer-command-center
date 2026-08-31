import type { Location } from "react-router-dom";

export interface NavigationBreadcrumb {
  label: string;
  to?: string;
}

export interface NavigationState {
  breadcrumbs: NavigationBreadcrumb[];
  returnTo: string;
  returnLabel: string;
  sourceCardId?: string;
  scrollY?: number;
}

export interface NavigationRestoreState {
  navigationRestore: { sourceCardId?: string; scrollY?: number };
  breadcrumbs?: NavigationBreadcrumb[];
}

export const navigationCardId = (kind: "goal" | "action" | "knowledge", id: string) => `${kind}-${id}`;

export function locationAddress(location: Pick<Location, "pathname" | "search" | "hash">) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function readNavigationState(value: unknown): NavigationState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<NavigationState> & { backTo?: unknown; backLabel?: unknown };
  const returnTo = typeof candidate.returnTo === "string" ? candidate.returnTo : typeof candidate.backTo === "string" ? candidate.backTo : undefined;
  const returnLabel = typeof candidate.returnLabel === "string" ? candidate.returnLabel : typeof candidate.backLabel === "string" ? candidate.backLabel : undefined;
  if (!returnTo || !returnLabel) return undefined;
  const breadcrumbs = readBreadcrumbs(candidate.breadcrumbs);
  return {
    breadcrumbs,
    returnTo,
    returnLabel,
    sourceCardId: typeof candidate.sourceCardId === "string" ? candidate.sourceCardId : undefined,
    scrollY: typeof candidate.scrollY === "number" && Number.isFinite(candidate.scrollY) ? candidate.scrollY : undefined
  };
}

export function readNavigationBreadcrumbs(value: unknown) {
  const navigation = readNavigationState(value);
  if (navigation) return navigation.breadcrumbs;
  if (!value || typeof value !== "object") return undefined;
  const breadcrumbs = readBreadcrumbs((value as { breadcrumbs?: unknown }).breadcrumbs);
  return breadcrumbs.length ? breadcrumbs : undefined;
}

function readBreadcrumbs(value: unknown): NavigationBreadcrumb[] {
  return Array.isArray(value)
    ? value.filter((item): item is NavigationBreadcrumb => Boolean(item && typeof item === "object" && typeof item.label === "string" && (item.to === undefined || typeof item.to === "string")))
    : [];
}

export function breadcrumbsForPage(state: unknown, fallback: NavigationBreadcrumb[], current: NavigationBreadcrumb) {
  const incoming = readNavigationBreadcrumbs(state);
  const base = incoming?.length ? incoming : fallback;
  const last = base.at(-1);
  const isCurrent = last?.label === current.label || (last?.to && current.to && last.to === current.to);
  return isCurrent ? base : [...base, current];
}

const restoreKey = (address: string) => `command-navigation-restore-v1:${address}`;

export function rememberNavigationState(state: NavigationState) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(restoreKey(state.returnTo), JSON.stringify({ sourceCardId: state.sourceCardId, scrollY: state.scrollY }));
}

export function readNavigationRestore(address: string) {
  if (typeof sessionStorage === "undefined") return undefined;
  try {
    const value = JSON.parse(sessionStorage.getItem(restoreKey(address)) ?? "null") as { sourceCardId?: unknown; scrollY?: unknown } | null;
    if (!value || (typeof value.sourceCardId !== "string" && typeof value.scrollY !== "number")) return undefined;
    return {
      sourceCardId: typeof value.sourceCardId === "string" ? value.sourceCardId : undefined,
      scrollY: typeof value.scrollY === "number" && Number.isFinite(value.scrollY) ? value.scrollY : undefined
    };
  } catch {
    return undefined;
  }
}

export function clearNavigationRestore(address: string) {
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(restoreKey(address));
}
