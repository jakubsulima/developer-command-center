import { CreationDialog } from "./CreationForm";
import { AddMenu, type AddMenuItem } from "./AddMenu";
import { lazy, Suspense, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Archive, CalendarCheck, CalendarDays, CheckSquare, ChevronDown, ChevronRight, Cloud, CloudOff, Download, Flag, FolderKanban, Inbox, LogOut, Menu, Plus, Repeat2, RotateCcw, Search, Settings, Sparkles } from "lucide-react";
import { Link, matchPath, NavLink, useLocation } from "react-router-dom";
import { useStore } from "../app/useStore";
import { useAuth } from "../auth/useAuth";
import { PageActionsContext } from "./page-actions-context";
import { CommandBrand } from "./CommandBrand";
import { useMobileNavIndicator } from "./mobile-nav-position";
import { QuickCapture } from "./QuickCapture";
import { GlobalSearch } from "./GlobalSearch";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Sheet } from "./ui/sheet";
import { AppLoading } from "../auth/AuthRoot";
import { AppErrorReporter } from "../lib/appErrorReporter";
import { beginPerformanceTiming } from "../lib/performanceMetrics";
import type { InboxItem } from "../domain/types";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { useNavigationRestoration } from "../hooks/useNavigationRestoration";
import "./mobile-more-sheet.css";

const QuickAdd = lazy(() => import("./QuickAdd").then((module) => ({ default: module.QuickAdd })));

export type AppShellQuickAddRequest = import("./QuickAdd").QuickAddRequest;

const navigation = [
  { to: "/", label: "Start", icon: CalendarDays },
  { to: "/projects", label: "Projekty", icon: FolderKanban },
  { to: "/routines", label: "Rutyny", icon: Repeat2 },
  { to: "/goals", label: "Grupy działań", icon: Flag },
  { to: "/actions", label: "Działania", icon: CheckSquare },
  { to: "/knowledge", label: "Wiedza", icon: Archive },
  { to: "/review", label: "Podsumowanie", icon: CalendarCheck },
  { to: "/ai", label: "Przegląd AI", icon: Sparkles },
];

const moreWorkspaceLinks = [
  { path: "/goals", label: "Grupy działań", description: "Powiązane działania", icon: Flag },
  { path: "/routines", label: "Rutyny", description: "Działania cykliczne", icon: Repeat2 },
  { path: "/ai", label: "Przegląd AI", description: "Rekomendacje dla grup działań", icon: Sparkles },
  { path: "/knowledge", section: "inbox", label: "Skrzynka", description: "Wpisy do uporządkowania", icon: Inbox },
  { path: "/review", label: "Podsumowanie", description: "Przegląd tygodnia", icon: CalendarCheck },
];

export type AppShellAddAction = {
  label: string;
  shortLabel?: string;
  ariaLabel: string;
  active?: boolean;
  onClick?: () => void;
  quickAdd?: AppShellQuickAddRequest;
  menu?: AddMenuItem[];
};

export function AppShell({ children, aside, addAction, appearance, loadingView = false, navigationReady = true }: { children: ReactNode; aside?: ReactNode; addAction?: AppShellAddAction; appearance?: "focus-detail"; loadingView?: boolean; navigationReady?: boolean }) {
  const { state, mode, loading, resetDemo, exportData, reload, syncState, dataFreshness } = useStore();
  const { user, signOut } = useAuth();
  const location = useLocation();
  useNavigationRestoration(!loading && navigationReady);
  const activeGoals = state.goals.filter((goal) => goal.visibility === "active" && goal.status === "active").length;
  const inbox = useWorkspaceInfinitePage<InboxItem>("inbox", 50, { inboxStatus: "unprocessed" });
  const newInboxCount = inbox.data?.totalCount ?? state.inbox.filter((item) => item.status === "unprocessed").length;
  const isAppleKeyboard = /Mac|iPhone|iPad/.test(navigator.platform);
  const activeRoutines = state.recurringActionTemplates.filter((routine) => routine.status === "active").length;
  const syncing = syncState.status === "syncing";
  const error = Object.values(syncState.errors)[0];
  const freshnessError = dataFreshness.status === "error";
  const dataStatus = dataFreshness.status === "refreshing"
    ? "Odświeżanie…"
    : freshnessError
      ? "Nie udało się odświeżyć — pokazujemy poprzednie dane"
      : dataFreshness.lastSuccessfulAt
        ? `Dane odświeżone ${new Date(dataFreshness.lastSuccessfulAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`
        : "Dane nie zostały jeszcze odświeżone";
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSession, setQuickAddSession] = useState(0);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureSaving, setCaptureSaving] = useState(false);
  const captureCloseGuard = useRef<(() => boolean) | null>(null);
  const [quickAddRequest, setQuickAddRequest] = useState<AppShellQuickAddRequest | undefined>();
  const quickAddReturnFocus = useRef<HTMLElement | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileCenterOpen, setProfileCenterOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const leaveAccount = () => {
    setSignOutError("");
    void signOut().catch((error) => setSignOutError(error instanceof Error ? error.message : "Nie udało się wylogować."));
  };
  const [exportState, setExportState] = useState<"idle" | "loading" | "error">("idle");
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const addActionRef = useRef(addAction);
  addActionRef.current = addAction;
  const initials = user?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const addIsOpen = quickAddOpen || Boolean(addAction?.active);
  const aiReviewActive = Boolean(matchPath("/ai", location.pathname));
  const knowledgeInboxActive = location.pathname === "/knowledge" && new URLSearchParams(location.search).get("section") === "inbox";
  const moreActive = knowledgeInboxActive || ["/review", "/goals", "/ai", "/routines", "/settings"].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const mobileNavIndicator = useMobileNavIndicator(loading, knowledgeInboxActive ? "/knowledge?section=inbox" : location.pathname);
  const openQuickAdd = useCallback((request?: AppShellQuickAddRequest) => {
    if (loadingView) return;
    quickAddReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    beginPerformanceTiming("quick-add");
    setQuickAddRequest(request);
    setQuickAddSession((session) => session + 1);
    setQuickAddOpen(true);
  }, [loadingView]);
  const closeQuickAdd = useCallback(() => {
    setQuickAddOpen(false);
    // The loading dialog and form are separate lazy mounts. Keep the original
    // trigger across that handoff, after the modal releases its inert background.
    window.requestAnimationFrame(() => {
      if (quickAddReturnFocus.current?.isConnected) quickAddReturnFocus.current.focus({ preventScroll: true });
    });
  }, []);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const scrollPosition = () => Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
    let previousY = 0;
    let travel = 0;
    const reset = () => {
      previousY = scrollPosition();
      travel = 0;
      setMobileHeaderHidden(false);
    };
    const handleScroll = () => {
      if (!mobile.matches) return;
      // A modal fixes the body and temporarily resets window.scrollY to zero.
      // Keep the gesture baseline until its saved page position is restored.
      if (document.body.style.position === "fixed" || document.querySelector("[data-modal-backdrop]")) return;
      const currentY = scrollPosition();
      const delta = currentY - previousY;
      previousY = currentY;
      if (!delta) return;
      // Ignore tiny direction changes and clamp elastic overscroll at both edges.
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (currentY <= 24) {
        setMobileHeaderHidden(false);
        travel = 0;
      } else if (Math.abs(travel) >= 12) {
        setMobileHeaderHidden(travel > 0);
        travel = 0;
      }
    };
    reset();
    window.addEventListener("scroll", handleScroll, { passive: true });
    mobile.addEventListener("change", reset);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      mobile.removeEventListener("change", reset);
    };
  }, [location.key]);
  useEffect(() => {
    const handleRequest = (event: Event) => {
      if (loadingView) return;
      openQuickAdd((event as CustomEvent<AppShellQuickAddRequest | undefined>).detail);
    };
    window.addEventListener("app-shell:quick-add", handleRequest);
    return () => window.removeEventListener("app-shell:quick-add", handleRequest);
  }, [loadingView, openQuickAdd]);
  useEffect(() => {
    if (!loadingView) return;
    setQuickAddOpen(false);
    setCaptureOpen(false);
    setMobileSearchOpen(false);
    setProfileCenterOpen(false);
    setProfileMenuOpen(false);
  }, [loadingView]);
  const triggerAdd = useCallback(() => {
    if (loadingView) return;
    // Keyboard shortcuts must not open a second editor over an active dialog.
    if (document.querySelector('[data-modal-backdrop]:not(.modal-backdrop-closing) [aria-modal="true"]')) return;
    const contextualAction = addActionRef.current;
    if (contextualAction?.quickAdd) {
      openQuickAdd(contextualAction.quickAdd);
      return;
    }
    if (contextualAction?.onClick) {
      contextualAction.onClick();
      return;
    }
    openQuickAdd(contextualAction?.quickAdd);
  }, [loadingView, openQuickAdd]);

  const downloadExport = async () => {
    if (exportState === "loading") return;
    setExportState("loading");
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `command-center-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportState("idle");
    } catch (caught) {
      AppErrorReporter.report(caught, "export");
      setExportState("error");
    } finally {
      setExportState((current) => current === "loading" ? "idle" : current);
    }
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (loadingView) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (document.querySelector('[data-modal-backdrop]:not(.modal-backdrop-closing) [aria-modal="true"]')) return;
        if (window.matchMedia("(max-width: 767px)").matches) {
          const input = document.getElementById("page-inline-search");
          const trigger = document.getElementById("page-inline-search-trigger");
          if (input) input.focus();
          else if (trigger) trigger.click();
          else setMobileSearchOpen(true);
        } else document.getElementById("global-search")?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (!document.querySelector('[data-modal-backdrop]:not(.modal-backdrop-closing) [aria-modal="true"]')) setCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loadingView, triggerAdd]);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  if (loading) return <AppLoading label="Ładowanie przestrzeni pracy…" />;

  return (
    <PageActionsContext.Provider value={
      addAction?.menu ? <AddMenu label={addAction.label} ariaLabel={addAction.ariaLabel} items={addAction.menu} disabled={loadingView} onSelect={openQuickAdd} /> : addAction ? <Button className={`page-add-button${addIsOpen ? " is-active" : ""}`} disabled={loadingView} aria-label={addAction.ariaLabel} title={addAction.label} aria-expanded={addIsOpen} aria-haspopup="dialog" onClick={triggerAdd}><Plus /><span>{addAction.label}</span></Button> : null
    }>
    <div className={`app-shell ${aside ? "with-aside" : ""}${appearance ? ` ${appearance}` : ""}${mobileHeaderHidden ? " mobile-header-hidden" : ""}`}>
      <a className="workspace-skip-link" href="#workspace-main" onClick={(event) => {
        event.preventDefault();
        document.getElementById("workspace-main")?.focus();
      }}>Przejdź do treści</a>
      <aside className="sidebar">
        <div className="brand"><CommandBrand /></div>
        <nav className="side-nav" aria-label="Główna nawigacja">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} aria-label={label} title={label} className={({ isActive }) => isActive && !(to === "/knowledge" && knowledgeInboxActive) ? "active" : ""} aria-current={to === "/knowledge" && knowledgeInboxActive ? false : undefined}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
          <Link to="/knowledge?section=inbox" className={knowledgeInboxActive ? "active" : ""} aria-current={knowledgeInboxActive ? "page" : undefined} title="Skrzynka"><Inbox aria-hidden="true" /><span>Skrzynka</span>{newInboxCount > 0 && <span className="nav-badge">{newInboxCount}<span className="sr-only"> nowych wpisów</span></span>}</Link>
        </nav>
        <div className="sidebar-bottom" ref={profileMenuRef}>
          {profileMenuOpen ? <div className="profile-popover" id="profile-menu" role="menu" aria-label="Opcje profilu">
            <div className={`profile-menu-status ${error || freshnessError ? "error" : ""}`}>{error || freshnessError ? <CloudOff /> : <Cloud />}<span><strong>{error ? "Błąd synchronizacji" : syncing ? mode === "demo" ? "Zapisywanie…" : "Synchronizacja…" : mode === "demo" ? "Zapisano na tym urządzeniu" : "Zsynchronizowano"}</strong><small>{mode === "demo" ? "Dane tylko w tej przeglądarce" : user?.email}</small></span></div>
            {mode === "supabase" ? <div className="profile-menu-freshness" data-testid="data-freshness"><small>{dataStatus}</small>{freshnessError ? <small>{dataFreshness.error}</small> : null}</div> : null}
            {mode === "supabase" ? <button role="menuitem" onClick={() => { setProfileMenuOpen(false); void reload().catch(() => undefined); }}><RotateCcw /><span>{freshnessError || error ? "Spróbuj ponownie" : "Odśwież dane"}</span></button> : null}
            {mode === "demo" ? <button role="menuitem" onClick={() => { resetDemo(); setProfileMenuOpen(false); }}><RotateCcw /><span>Przywróć dane demo</span></button> : null}
            <NavLink role="menuitem" className="profile-settings-link" to="/settings" onClick={() => setProfileMenuOpen(false)}><Settings /><span>Ustawienia</span></NavLink>
            <button role="menuitem" disabled={exportState === "loading"} onClick={() => { setProfileMenuOpen(false); void downloadExport(); }}><Download /><span>{exportState === "loading" ? "Eksportowanie…" : "Eksportuj dane"}</span></button>
            {exportState === "error" ? <p className="inline-mutation-error" role="alert">Nie udało się wyeksportować danych. Spróbuj ponownie.</p> : null}
            {mode === "supabase" ? <button className="danger" role="menuitem" onClick={() => { setProfileMenuOpen(false); leaveAccount(); }}><LogOut /><span>Wyloguj się</span></button> : null}
          </div> : null}
          <button className="profile-row" type="button" disabled={loadingView} aria-disabled={loadingView || undefined} aria-expanded={profileMenuOpen} aria-controls="profile-menu" aria-label="Otwórz menu profilu" onClick={() => setProfileMenuOpen((open) => !open)}><Avatar className="avatar"><AvatarFallback className="bg-transparent text-inherit">{initials}</AvatarFallback></Avatar><span><strong>{user?.name}</strong><small>{mode === "demo" ? "Tryb demonstracyjny" : user?.email}</small></span><ChevronDown /></button>
        </div>
      </aside>

      <header className="topbar">
        <div className="desktop-global-search"><GlobalSearch disabled={loadingView} /></div>
        <div className="top-actions">
          <Button className="desktop-capture-button" disabled={loadingView} onClick={() => setCaptureOpen(true)}><Plus />Szybki zapis<kbd>{isAppleKeyboard ? "⌘J" : "Ctrl+J"}</kbd></Button>
        </div>
      </header>

      <main className="main-content" id="workspace-main" tabIndex={-1}>
        <header className="mobile-shell-heading"><div className="mobile-brand"><CommandBrand /></div></header>
        {error || freshnessError ? <div className="shell-sync-alert" role="status"><CloudOff /><span>{error ? "Nie udało się zsynchronizować zmian." : "Nie udało się odświeżyć danych."}</span><Button variant="ghost" onClick={() => void reload().catch(() => undefined)}>Spróbuj ponownie</Button></div> : null}
        {signOutError && !profileCenterOpen ? <p role="alert">{signOutError}</p> : null}
        {children}
      </main>
      {aside && <aside className="context-rail">{aside}</aside>}

      <nav className="bottom-nav" aria-label="Nawigacja mobilna" data-compact={(!aiReviewActive && mobileHeaderHidden) || undefined}>
        <NavLink to="/" end aria-label="Start">
          <CalendarDays aria-hidden="true" /><span className="bottom-nav-label" aria-hidden="true">Start</span>
        </NavLink>
        <NavLink to="/projects" aria-label="Projekty">
          <FolderKanban aria-hidden="true" /><span className="bottom-nav-label" aria-hidden="true">Projekty</span>
        </NavLink>
        <NavLink to="/knowledge" aria-label="Wiedza" aria-current={knowledgeInboxActive ? false : undefined} className={({ isActive }) => isActive && !knowledgeInboxActive ? "active" : ""}>
          <Archive aria-hidden="true" /><span className="bottom-nav-label" aria-hidden="true">Wiedza</span>
        </NavLink>
        <NavLink to="/actions" aria-label="Działania">
          <CheckSquare aria-hidden="true" /><span className="bottom-nav-label" aria-hidden="true">Działania</span>
        </NavLink>
        <button type="button" className="mobile-more-trigger" disabled={loadingView} aria-disabled={loadingView || undefined} aria-current={moreActive ? "page" : undefined} aria-haspopup="dialog" aria-expanded={profileCenterOpen} onClick={() => setProfileCenterOpen(true)} aria-label="Otwórz menu Więcej">
          <Menu aria-hidden="true" /><span className="bottom-nav-label" aria-hidden="true">Więcej</span>
        </button>
        <span ref={mobileNavIndicator} className="bottom-nav-indicator" aria-hidden="true" />
      </nav>
      <CreationDialog open={captureOpen} closeDisabled={captureSaving} title="Szybki zapis" className="quick-capture-modal" onClose={() => { if (!captureCloseGuard.current || captureCloseGuard.current()) setCaptureOpen(false); }}><QuickCapture onSavingChange={setCaptureSaving} closeGuard={captureCloseGuard} onClose={() => setCaptureOpen(false)} /></CreationDialog>
      {quickAddSession ? <Suspense fallback={<CreationDialog open={quickAddOpen} title="Dodaj" initialFocus="none" onClose={closeQuickAdd}><p role="status">Otwieranie formularza…</p></CreationDialog>}><QuickAdd key={quickAddSession} open={quickAddOpen} request={quickAddRequest} onClose={closeQuickAdd} /></Suspense> : null}
      <Modal open={mobileSearchOpen} title="Wyszukiwanie globalne" className="search-modal" backdropClassName="search-backdrop" initialFocus="input" exitDurationMs={160} onClose={() => setMobileSearchOpen(false)}><div className="mobile-global-search"><GlobalSearch visible={mobileSearchOpen} id="mobile-global-search" onNavigate={() => setMobileSearchOpen(false)} /></div></Modal>
      <Sheet open={profileCenterOpen} title="Więcej" onOpenChange={setProfileCenterOpen} className="mobile-more-sheet">
        <div className="mobile-more-content">
          <div className="mobile-more-tools" role="group" aria-label="Szybkie narzędzia">
            <button type="button" onClick={() => { setProfileCenterOpen(false); setMobileSearchOpen(true); }}>
              <Search aria-hidden="true" /> Wyszukaj
            </button>
            <button type="button" onClick={() => { setProfileCenterOpen(false); openQuickAdd(); }}>
              <Plus aria-hidden="true" /> Dodaj
            </button>
          </div>

          <section>
            <h3 id="mobile-more-work-heading">Przestrzeń pracy</h3>
            <nav className="mobile-more-group" aria-labelledby="mobile-more-work-heading">
              {moreWorkspaceLinks.map(({ path, section, label, description, icon: Icon }) => {
                const current = section === "inbox" ? knowledgeInboxActive : matchPath({ path, end: false }, location.pathname);
                const count = path === "/goals" ? activeGoals : path === "/routines" ? activeRoutines : section === "inbox" && newInboxCount > 0 ? newInboxCount : undefined;
                const to = section ? `${path}?section=${section}` : path;
                return (
                  <Link key={to} className="mobile-more-row" to={to} aria-current={current ? "page" : undefined} onClick={() => setProfileCenterOpen(false)}>
                    <span className="mobile-more-icon"><Icon aria-hidden="true" /></span>
                    <span className="mobile-more-copy"><strong>{label}</strong><small>{description}</small></span>
                    {count !== undefined && <span className="mobile-more-count">{count}<span className="sr-only">{path === "/goals" ? " aktywnych grup" : path === "/routines" ? " aktywnych rutyn" : " nowych wpisów"}</span></span>}
                    <ChevronRight className="mobile-more-chevron" aria-hidden="true" />
                  </Link>
                );
              })}
            </nav>
          </section>

          <section aria-labelledby="mobile-more-account-heading">
            <h3 id="mobile-more-account-heading">Konto i dane</h3>
            <div className="mobile-more-group">
              <div className="mobile-more-profile">
                <Avatar className="avatar" aria-hidden="true"><AvatarFallback className="bg-transparent text-inherit">{initials}</AvatarFallback></Avatar>
                <span className="mobile-more-copy"><strong>{user?.name}</strong><small>{mode === "demo" ? "Tryb demonstracyjny" : user?.email}</small></span>
              </div>
              {mode === "supabase" && (
                <div className="mobile-more-status" data-error={Boolean(error || freshnessError)} data-testid="data-freshness" role="status">
                  {error || freshnessError ? <CloudOff aria-hidden="true" /> : <Cloud aria-hidden="true" />}
                  <span className="mobile-more-copy">
                    <strong>{error ? "Błąd synchronizacji" : syncing && !freshnessError ? "Synchronizowanie…" : dataStatus}</strong>
                    {error && freshnessError && <small>{dataStatus}</small>}
                    {freshnessError && dataFreshness.error && <small>{dataFreshness.error}</small>}
                  </span>
                </div>
              )}
              <NavLink className="mobile-more-row" to="/settings" onClick={() => setProfileCenterOpen(false)}>
                <Settings aria-hidden="true" /> <span>Ustawienia</span><ChevronRight className="mobile-more-chevron" aria-hidden="true" />
              </NavLink>
              {mode === "supabase" && (
                <button className="mobile-more-row" type="button" disabled={dataFreshness.status === "refreshing"} onClick={() => void reload().catch(() => undefined)}>
                  <RotateCcw aria-hidden="true" /> {freshnessError || error ? "Spróbuj ponownie" : "Odśwież dane"}
                </button>
              )}
              <button className="mobile-more-row" type="button" disabled={exportState === "loading"} onClick={() => void downloadExport()}>
                <Download aria-hidden="true" /> {exportState === "loading" ? "Eksportowanie…" : "Eksport danych"}
              </button>
              {exportState === "error" && <p className="mobile-more-error" role="alert">Nie udało się wyeksportować danych. Spróbuj ponownie.</p>}
              {mode === "demo" && (
                <button className="mobile-more-row" type="button" onClick={() => { resetDemo(); setProfileCenterOpen(false); }}>
                  <RotateCcw aria-hidden="true" /> Przywróć dane demo
                </button>
              )}
              {mode === "supabase" && (
                <button className="mobile-more-row mobile-more-sign-out" type="button" onClick={leaveAccount}>
                  <LogOut aria-hidden="true" /> Wyloguj się
                </button>
              )}
              {signOutError && <p className="mobile-more-error" role="alert">{signOutError}</p>}
            </div>
          </section>
        </div>
      </Sheet>
    </div>
    </PageActionsContext.Provider>
  );
}

export function PageActions({ children }: { children?: ReactNode }) {
  const add = useContext(PageActionsContext);
  return <div className="page-actions">{children}{add}</div>;
}

export function PageHeading({ title, eyebrow, context, action, className = "" }: { title?: string; eyebrow?: string; context?: ReactNode; action?: ReactNode; className?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    const closeOnResize = (event: MediaQueryListEvent) => {
      if (!event.matches) setSearchOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (!searchPanelRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    mobile.addEventListener("change", closeOnResize);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      mobile.removeEventListener("change", closeOnResize);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    window.requestAnimationFrame(() => searchTriggerRef.current?.focus());
  };

  return (
    <div className={`page-heading ${className}${context ? " page-heading-with-context" : ""}${searchOpen ? " is-search-open" : ""}`.trim()}>
      <div className="page-heading-copy">
        {title && <h1>{title}</h1>}
        <div className="mobile-brand"><CommandBrand compact={searchOpen} /></div>
        {eyebrow && !searchOpen && <span className="eyebrow">{eyebrow}</span>}
      </div>
      {searchOpen ? <div ref={searchPanelRef} id="page-inline-search-panel" className="page-inline-search" role="search" aria-label="Wyszukiwanie globalne" onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
      }} onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.stopPropagation();
        closeSearch();
      }}>
        <GlobalSearch id="page-inline-search" autoFocus onNavigate={() => setSearchOpen(false)} />
        <button className="page-inline-search-close" type="button" onClick={closeSearch}>Zamknij</button>
      </div> : <>
        <PageActions>
          <button ref={searchTriggerRef} id="page-inline-search-trigger" type="button" className="icon-button page-search-button" aria-label="Otwórz wyszukiwanie" onClick={() => setSearchOpen(true)}><Search aria-hidden="true" /></button>
        </PageActions>
      </>}
      {context ? <div className="page-heading-context">{context}</div> : null}
      {action && !searchOpen ? <div className="page-heading-secondary">{action}</div> : null}
    </div>
  );
}
