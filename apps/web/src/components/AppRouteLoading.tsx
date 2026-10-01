import { AppShell } from "./AppShell";

export function AppRouteLoading() {
  return <AppShell loadingView><section className="route-loading" role="status" aria-label="Ładowanie widoku">
    <div className="route-loading-heading"><span /><span /></div>
    <div className="route-loading-card"><span /><span /><span /></div>
    <div className="route-loading-card"><span /><span /><span /></div>
    <div className="route-loading-card"><span /><span /></div>
  </section></AppShell>;
}
