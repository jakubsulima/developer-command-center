import { useEffect, useRef, useState, type ReactNode } from "react";
import { Archive, Box, CalendarCheck, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Cloud, CloudOff, Download, Flag, FolderKanban, Inbox, LogOut, Menu, Plus, Repeat2, RotateCcw, Search, Sparkles, TerminalSquare, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useStore } from "../app/useStore";
import { useAuth } from "../auth/useAuth";
import { GlobalSearch } from "./GlobalSearch";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { QuickAdd } from "./QuickAdd";

const navigation = [
  { to: "/", label: "Dzisiaj", icon: CalendarDays },
  { to: "/projects", label: "Projekty", icon: FolderKanban },
  { to: "/routines", label: "Rutyny", icon: Repeat2 },
  { to: "/goals", label: "Cele", icon: Flag },
  { to: "/knowledge", label: "Wiedza", icon: Archive },
  { to: "/inbox", label: "Inbox", icon: Inbox, badge: true },
  { to: "/review", label: "Podsumowanie", icon: CalendarCheck },
];

export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const { state, mode, syncing, error, resetDemo, exportData, reload } = useStore();
  const { user, signOut } = useAuth();
  const pending = state.inbox.filter((item) => item.status === "unprocessed").length;
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileCenterOpen, setProfileCenterOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const initials = user?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const profileStats = [
    { label: "Aktywne cele", value: state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").length, icon: Flag },
    { label: "Ukończone", value: state.actions.filter((action) => action.status === "completed").length, icon: CheckCircle2 },
    { label: "Wiedza", value: state.knowledge.filter((item) => !item.trashedAt).length, icon: Archive },
    { label: "Inbox", value: pending, icon: Inbox }
  ];

  const downloadExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `command-center-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
        setQuickAddOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
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
            <button role="menuitem" onClick={() => { setProfileMenuOpen(false); void downloadExport(); }}><Download /><span>Eksportuj dane</span></button>
            {mode === "supabase" ? <button className="danger" role="menuitem" onClick={() => { setProfileMenuOpen(false); void signOut(); }}><LogOut /><span>Wyloguj się</span></button> : null}
          </div> : null}
          <button className="profile-row" type="button" aria-expanded={profileMenuOpen} aria-controls="profile-menu" aria-label="Otwórz menu profilu" onClick={() => setProfileMenuOpen((open) => !open)}><span className="avatar">{initials}</span><span><strong>{user?.name}</strong><small>{mode === "demo" ? "Tryb demonstracyjny" : user?.email}</small></span><ChevronDown /></button>
        </div>
      </aside>

      <header className="topbar">
        <span className="mobile-brand" aria-hidden="true"><span className="brand-mark"><TerminalSquare /></span><span>Command</span></span>
        <div className="desktop-global-search"><GlobalSearch /></div>
        <button className="icon-button mobile-search-trigger" aria-label="Otwórz wyszukiwanie" onClick={() => setMobileSearchOpen(true)}><Search /></button>
        <div className="top-actions">
          <Button aria-label="Otwórz szybkie dodawanie" onClick={() => setQuickAddOpen(true)}><Plus />Dodaj <kbd className="quick-add-shortcut">⌘J</kbd></Button>
          {mode === "demo" ? <span className="demo-pill"><Box /> Tryb demo</span> : <span className={`demo-pill ${error ? "sync-error" : ""}`}>{error ? <CloudOff /> : <Cloud />}{error ? "Błąd synchronizacji" : syncing ? "Synchronizacja…" : "Zsynchronizowano"}</span>}
        </div>
      </header>

      <main className="main-content">{children}</main>
      {aside && <aside className="context-rail">{aside}</aside>}

      <nav className="bottom-nav" aria-label="Nawigacja mobilna">
        <NavLink to="/" end><CalendarDays /><span>Dzisiaj</span></NavLink>
        <NavLink to="/projects"><FolderKanban /><span>Projekty</span></NavLink>
        <button className={`capture-fab ${quickAddOpen ? "active" : ""}`} aria-expanded={quickAddOpen} onClick={() => setQuickAddOpen(true)} aria-label="Otwórz centrum dodawania"><span className="capture-fab-icon"><Plus /></span><span>Dodaj</span></button>
        <NavLink to="/knowledge"><Archive /><span>Wiedza</span></NavLink>
        <button className="mobile-more-trigger" onClick={() => setProfileCenterOpen(true)} aria-label="Otwórz centrum profilu"><span className="mobile-nav-icon"><Menu /></span><span>Więcej</span></button>
      </nav>
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <Modal open={mobileSearchOpen} title="Wyszukiwanie globalne" className="search-modal" initialFocus="input" onClose={() => setMobileSearchOpen(false)}><div className="mobile-global-search"><GlobalSearch id="mobile-global-search" onNavigate={() => setMobileSearchOpen(false)} /></div></Modal>
      <Modal open={profileCenterOpen} title="Twoje centrum" className="profile-center-modal" onClose={() => setProfileCenterOpen(false)}><div className="mobile-profile-center">
        <section className="mobile-profile-card" aria-label="Profil użytkownika"><span className="avatar profile-center-avatar">{initials}</span><span><small>Profil</small><strong>{user?.name}</strong><span>{mode === "demo" ? "Tryb demonstracyjny" : user?.email}</span></span><UserRound /></section>
        <section aria-labelledby="profile-stats-heading"><div className="mobile-center-heading"><h3 id="profile-stats-heading">Twój workspace</h3><span>krótkie podsumowanie</span></div><div className="profile-stats-grid">{profileStats.map(({ label, value, icon: Icon }) => <div key={label}><Icon /><strong>{value}</strong><small>{label}</small></div>)}</div></section>
        <section aria-labelledby="profile-settings-heading"><div className="mobile-center-heading"><h3 id="profile-settings-heading">Profil i dane</h3><span>ustawienia workspace</span></div><div className="profile-settings-list">
          <div className={`profile-sync-card ${error ? "error" : ""}`}>{error ? <CloudOff /> : <Cloud />}<span><strong>{error ? "Błąd synchronizacji" : syncing ? "Synchronizacja…" : "Dane są bezpieczne"}</strong><small>{error ? error : mode === "demo" ? "Zapisane w tej przeglądarce" : user?.email}</small></span>{error ? <button type="button" onClick={() => void reload()} aria-label="Spróbuj ponownie"><RotateCcw /></button> : null}</div>
          <NavLink to="/review" onClick={() => setProfileCenterOpen(false)}><CalendarCheck /><span><strong>Statystyki i podsumowanie</strong><small>Zobacz postęp z ostatniego tygodnia</small></span><ChevronRight /></NavLink>
          <button type="button" onClick={() => void downloadExport()}><Download /><span><strong>Eksport danych</strong><small>Pobierz kopię swojego workspace</small></span><ChevronRight /></button>
          {mode === "demo" ? <button type="button" onClick={() => { resetDemo(); setProfileCenterOpen(false); }}><RotateCcw /><span><strong>Przywróć dane demo</strong><small>Rozpocznij ponownie z przykładową zawartością</small></span><ChevronRight /></button> : null}
          {mode === "supabase" ? <button className="danger" type="button" onClick={() => void signOut()}><LogOut /><span><strong>Wyloguj się</strong><small>Zakończ bieżącą sesję</small></span><ChevronRight /></button> : null}
        </div></section>
      </div></Modal>
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
