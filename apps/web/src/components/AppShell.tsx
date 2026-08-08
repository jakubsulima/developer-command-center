import { useEffect, useRef, useState, type ReactNode } from "react";
import { Archive, Box, CalendarCheck, CalendarDays, ChevronDown, Cloud, CloudOff, Download, Flag, FolderKanban, Inbox, LogOut, Menu, Plus, Repeat2, RotateCcw, Search, Sparkles, TerminalSquare } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const initials = user?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";

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
        <div className="desktop-global-search"><GlobalSearch /></div>
        <button className="icon-button mobile-search-trigger" aria-label="Otwórz wyszukiwanie" onClick={() => setMobileSearchOpen(true)}><Search /></button>
        <button className="icon-button mobile-menu-trigger" aria-label="Menu Workspace" onClick={() => setMobileMenuOpen(true)}><Menu /></button>
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
        <button className="capture-fab" onClick={() => setQuickAddOpen(true)} aria-label="Dodaj Działanie, Cel, Wiedzę lub wpis do Inboxu"><Plus /></button>
        <NavLink to="/knowledge"><Archive /><span>Wiedza</span></NavLink>
        <button className="mobile-more-trigger" onClick={() => setMobileMenuOpen(true)} aria-label="Otwórz więcej opcji"><span className="mobile-nav-icon"><Menu />{pending > 0 ? <span className="nav-badge">{pending}</span> : null}</span><span>Więcej</span></button>
      </nav>
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <Modal open={mobileSearchOpen} title="Wyszukiwanie globalne" onClose={() => setMobileSearchOpen(false)}><div className="mobile-global-search"><GlobalSearch id="mobile-global-search" onNavigate={() => setMobileSearchOpen(false)} /></div></Modal>
      <Modal open={mobileMenuOpen} title="Więcej" onClose={() => setMobileMenuOpen(false)}><div className="mobile-workspace-menu"><nav className="mobile-more-nav" aria-label="Więcej opcji"><NavLink to="/goals" onClick={() => setMobileMenuOpen(false)}><Flag /><span><strong>Cele</strong><small>Rezultaty i następne kroki</small></span></NavLink><NavLink to="/routines" onClick={() => setMobileMenuOpen(false)}><Repeat2 /><span><strong>Rutyny</strong><small>Działania cykliczne</small></span></NavLink><NavLink to="/inbox" onClick={() => setMobileMenuOpen(false)}><Inbox /><span><strong>Inbox</strong><small>{pending ? `${pending} elementów czeka` : "Wszystko przejrzane"}</small></span></NavLink><NavLink to="/review" onClick={() => setMobileMenuOpen(false)}><CalendarCheck /><span><strong>Podsumowanie</strong><small>Automatyczny przegląd tygodnia</small></span></NavLink></nav><p className={`sync-mobile ${error ? "error" : ""}`}>{error ? <CloudOff /> : <Cloud />}{error ? `Błąd synchronizacji: ${error}` : syncing ? "Synchronizacja…" : "Zsynchronizowano"}</p>{error ? <Button onClick={() => void reload()}><RotateCcw />Spróbuj ponownie</Button> : null}{mode === "demo" ? <Button onClick={() => { resetDemo(); setMobileMenuOpen(false); }}><RotateCcw />Przywróć demo</Button> : null}<Button onClick={() => void downloadExport()}><Download />Eksportuj dane</Button>{mode === "supabase" ? <Button onClick={() => void signOut()}><LogOut />Wyloguj się</Button> : null}</div></Modal>
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
