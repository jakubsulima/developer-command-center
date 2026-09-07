import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Archive, Box, CalendarCheck, CalendarDays, ChevronDown, ChevronRight, Cloud, CloudOff, Download, Flag, FolderKanban, Inbox, LogOut, Menu, Plus, Repeat2, RotateCcw, Search, Sparkles, TerminalSquare } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useStore } from "../app/useStore";
import { useAuth } from "../auth/useAuth";
import { GlobalSearch } from "./GlobalSearch";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Sheet } from "./ui/sheet";
import { AppLoading } from "../auth/AuthRoot";
import { AppErrorReporter } from "../lib/appErrorReporter";
import { beginPerformanceTiming } from "../lib/performanceMetrics";
import { useNavigationRestoration } from "../hooks/useNavigationRestoration";

const QuickAdd = lazy(() => import("./QuickAdd").then((module) => ({ default: module.QuickAdd })));

const navigation = [
  { to: "/", label: "Start", icon: CalendarDays },
  { to: "/projects", label: "Projekty", icon: FolderKanban },
  { to: "/routines", label: "Rutyny", icon: Repeat2 },
  { to: "/goals", label: "Cele", icon: Flag },
  { to: "/knowledge", label: "Wiedza", icon: Archive, badge: true },
  { to: "/review", label: "Podsumowanie", icon: CalendarCheck },
];

export type AppShellAddAction = {
  label: string;
  shortLabel?: string;
  ariaLabel: string;
  active?: boolean;
  onClick: () => void;
};

export function AppShell({ children, aside, addAction }: { children: ReactNode; aside?: ReactNode; addAction?: AppShellAddAction }) {
  const { state, mode, loading, resetDemo, exportData, reload, syncState } = useStore();
  const { user, signOut } = useAuth();
  const location = useLocation();
  useNavigationRestoration();
  const pending = state.inbox.filter((item) => item.status === "unprocessed").length;
  const activeGoals = state.goals.filter((goal) => goal.visibility === "active" && goal.status === "active").length;
  const activeRoutines = state.recurringActionTemplates.filter((routine) => routine.status === "active").length;
  const syncing = syncState.status === "syncing";
  const error = Object.values(syncState.errors)[0];
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileCenterOpen, setProfileCenterOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "loading" | "error">("idle");
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const addActionRef = useRef(addAction);
  addActionRef.current = addAction;
  const initials = user?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const moreActive = ["/goals", "/routines", "/review"].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const openQuickAdd = useCallback(() => {
    beginPerformanceTiming("quick-add");
    setQuickAddOpen(true);
  }, []);
  const triggerAdd = useCallback(() => {
    const contextualAction = addActionRef.current;
    if (contextualAction) {
      contextualAction.onClick();
      return;
    }
    openQuickAdd();
  }, [openQuickAdd]);

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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (window.matchMedia("(max-width: 767px)").matches) setMobileSearchOpen(true);
        else document.getElementById("global-search")?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openQuickAdd]);
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

  if (loading) return <AppLoading label="Ładowanie Workspace…" />;

  return (
    <div className={`app-shell ${aside ? "with-aside" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><TerminalSquare /></span><span>Command</span></div>
        <nav className="side-nav" aria-label="Główna nawigacja">
          {navigation.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon /><span>{label}</span>{badge && pending > 0 && <span className="nav-badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom" ref={profileMenuRef}>
          {profileMenuOpen ? <div className="profile-popover" id="profile-menu" role="menu" aria-label="Opcje profilu">
            <div className={`profile-menu-status ${error ? "error" : ""}`}>{error ? <CloudOff /> : <Cloud />}<span><strong>{error ? "Błąd synchronizacji" : syncing ? "Synchronizacja…" : "Zsynchronizowano"}</strong><small>{mode === "demo" ? "Dane tylko w tej przeglądarce" : user?.email}</small></span></div>
            {error ? <button role="menuitem" onClick={() => { setProfileMenuOpen(false); void reload(); }}><RotateCcw /><span>Spróbuj ponownie</span></button> : null}
            {mode === "demo" ? <button role="menuitem" onClick={() => { resetDemo(); setProfileMenuOpen(false); }}><RotateCcw /><span>Przywróć dane demo</span></button> : null}
            <button role="menuitem" disabled={exportState === "loading"} onClick={() => { setProfileMenuOpen(false); void downloadExport(); }}><Download /><span>{exportState === "loading" ? "Eksportowanie…" : "Eksportuj dane"}</span></button>
            {exportState === "error" ? <p className="inline-mutation-error" role="alert">Nie udało się wyeksportować danych. Spróbuj ponownie.</p> : null}
            {mode === "supabase" ? <button className="danger" role="menuitem" onClick={() => { setProfileMenuOpen(false); void signOut(); }}><LogOut /><span>Wyloguj się</span></button> : null}
          </div> : null}
          <button className="profile-row" type="button" aria-expanded={profileMenuOpen} aria-controls="profile-menu" aria-label="Otwórz menu profilu" onClick={() => setProfileMenuOpen((open) => !open)}><Avatar className="avatar"><AvatarFallback className="bg-transparent text-inherit">{initials}</AvatarFallback></Avatar><span><strong>{user?.name}</strong><small>{mode === "demo" ? "Tryb demonstracyjny" : user?.email}</small></span><ChevronDown /></button>
        </div>
      </aside>

      <header className="topbar">
        <span className="mobile-brand" aria-hidden="true"><span className="brand-mark"><TerminalSquare /></span><span>Command</span></span>
        <div className="desktop-global-search"><GlobalSearch /></div>
        <button className="icon-button mobile-search-trigger" aria-label="Otwórz wyszukiwanie" onClick={() => setMobileSearchOpen(true)}><Search /></button>
        <div className="top-actions">
          <Button aria-label={addAction?.ariaLabel ?? "Otwórz szybkie dodawanie"} onClick={triggerAdd}><Plus />{addAction?.label ?? "Dodaj"} <kbd className="quick-add-shortcut">⌘J</kbd></Button>
          {mode === "demo" ? <span className="demo-pill"><Box /> Tryb demo</span> : <span className={`demo-pill ${error ? "sync-error" : ""}`}>{error ? <CloudOff /> : <Cloud />}{error ? "Błąd synchronizacji" : syncing ? "Synchronizacja…" : "Zsynchronizowano"}</span>}
        </div>
      </header>

      <main className="main-content">{children}</main>
      {aside && <aside className="context-rail">{aside}</aside>}

      <nav className="bottom-nav" aria-label="Nawigacja mobilna">
        <NavLink to="/" end><CalendarDays /><span>Start</span></NavLink>
        <NavLink to="/projects"><FolderKanban /><span>Projekty</span></NavLink>
        <button className={`capture-fab ${quickAddOpen || addAction?.active ? "active" : ""}`} aria-expanded={addAction ? addAction.active : quickAddOpen} onClick={triggerAdd} aria-label={addAction?.ariaLabel ?? "Otwórz centrum dodawania"}><span className="capture-fab-icon"><Plus /></span><span>{addAction?.shortLabel ?? addAction?.label ?? "Dodaj"}</span></button>
        <NavLink to="/knowledge" className={({ isActive }) => isActive ? "active mobile-inbox-link" : "mobile-inbox-link"}><span className="mobile-nav-icon"><Archive />{pending > 0 && <span className="nav-badge">{pending}</span>}</span><span>Wiedza</span></NavLink>
      <button className={`mobile-more-trigger ${moreActive ? "active" : ""}`} aria-current={moreActive ? "page" : undefined} onClick={() => setProfileCenterOpen(true)} aria-label="Otwórz menu Więcej"><span className="mobile-nav-icon"><Menu /></span><span>Więcej</span></button>
      </nav>
      <Suspense fallback={null}><QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} /></Suspense>
      <Modal open={mobileSearchOpen} title="Wyszukiwanie globalne" className="search-modal" backdropClassName="search-backdrop" initialFocus="input" exitDurationMs={160} onClose={() => setMobileSearchOpen(false)}><div className="mobile-global-search"><GlobalSearch id="mobile-global-search" onNavigate={() => setMobileSearchOpen(false)} /></div></Modal>
      <Sheet open={profileCenterOpen} title="Więcej" onOpenChange={setProfileCenterOpen} className="profile-center-modal"><div className="mobile-profile-center compact-more-panel">
        <section className="mobile-more-overview" aria-label="Profil i stan Workspace"><section className="mobile-profile-card" aria-label="Profil użytkownika"><Avatar className="avatar profile-center-avatar"><AvatarFallback className="bg-transparent text-inherit">{initials}</AvatarFallback></Avatar><span><strong>{user?.name}</strong><small>{mode === "demo" ? "Tryb demonstracyjny" : user?.email}</small></span>{error ? <CloudOff /> : <Cloud />}</section><div className={`mobile-workspace-status ${error ? "error" : ""}`}><span>{error ? <CloudOff /> : <Cloud />}{error ? "Wymaga uwagi" : syncing ? "Synchronizowanie…" : "Workspace aktualny"}</span><small>{mode === "demo" ? "Dane lokalne" : "Synchronizacja aktywna"}</small></div></section>
        <section aria-labelledby="mobile-more-tools-heading"><h3 id="mobile-more-tools-heading" className="mobile-more-section-heading">Szybkie narzędzia</h3><div className="mobile-more-tools">
          <button type="button" onClick={() => { setProfileCenterOpen(false); setMobileSearchOpen(true); }}><span><Search /></span><strong>Wyszukaj</strong><small>W całym Workspace</small></button>
          <button type="button" onClick={() => { setProfileCenterOpen(false); openQuickAdd(); }}><span><Plus /></span><strong>Dodaj dowolne</strong><small>Pełny wybór typów</small></button>
        </div></section>
        <section aria-labelledby="mobile-more-work-heading"><h3 id="mobile-more-work-heading" className="mobile-more-section-heading">Workspace</h3><nav className="mobile-more-grid" aria-label="Nawigacja pracy">
          <NavLink to="/goals" onClick={() => setProfileCenterOpen(false)}><span><Flag /></span><span><strong>Cele</strong><small>Aktywne rezultaty</small></span><b>{activeGoals}</b></NavLink>
          <NavLink to="/routines" onClick={() => setProfileCenterOpen(false)}><span><Repeat2 /></span><span><strong>Rutyny</strong><small>Aktywne serie</small></span><b>{activeRoutines}</b></NavLink>
          <NavLink to="/knowledge?section=inbox" onClick={() => setProfileCenterOpen(false)}><span><Inbox /></span><span><strong>Skrzynka</strong><small>Do uporządkowania</small></span><b>{pending}</b></NavLink>
          <NavLink to="/review" onClick={() => setProfileCenterOpen(false)}><span><CalendarCheck /></span><span><strong>Podsumowanie</strong><small>Przegląd tygodnia</small></span><ChevronRight /></NavLink>
        </nav></section>
        <section aria-labelledby="mobile-more-account-heading"><h3 id="mobile-more-account-heading" className="mobile-more-section-heading">Dane i konto</h3><div className="mobile-more-actions" aria-label="Akcje konta i danych">
          {error ? <button type="button" onClick={() => void reload()}><RotateCcw /><span>Spróbuj ponownie</span></button> : null}
          <button type="button" disabled={exportState === "loading"} onClick={() => void downloadExport()}><Download /><span>{exportState === "loading" ? "Eksportowanie…" : "Eksport danych"}</span></button>
          {exportState === "error" ? <p className="inline-mutation-error" role="alert">Nie udało się wyeksportować danych. Spróbuj ponownie.</p> : null}
          {mode === "demo" ? <button type="button" onClick={() => { resetDemo(); setProfileCenterOpen(false); }}><RotateCcw /><span>Przywróć dane demo</span></button> : null}
          {mode === "supabase" ? <button className="danger" type="button" onClick={() => void signOut()}><LogOut /><span>Wyloguj się</span></button> : null}
        </div></section>
      </div></Sheet>
    </div>
  );
}

export function PageHeading({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>{eyebrow && <span className="eyebrow"><Sparkles />{eyebrow}</span>}<h1>{title}</h1></div>
      {action}
    </div>
  );
}
