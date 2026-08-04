import { useEffect, type ReactNode } from "react";
import { Archive, BookOpen, Box, CalendarDays, ChevronDown, ClipboardCheck, Cloud, CloudOff, Download, Folder, Inbox, LogOut, MoreHorizontal, Plus, RotateCcw, Sparkles, TerminalSquare } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { useAuth } from "../auth/useAuth";
import { GlobalSearch } from "./GlobalSearch";

const navigation = [
  { to: "/", label: "Dzisiaj", icon: CalendarDays },
  { to: "/inbox", label: "Inbox", icon: Inbox, badge: true },
  { to: "/projects", label: "Projekty", icon: Folder },
  { to: "/learning", label: "Nauka", icon: BookOpen },
  { to: "/knowledge", label: "Wiedza", icon: Archive, desktop: true },
  { to: "/review", label: "Przeglądy", icon: ClipboardCheck, desktop: true }
];

export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const { state, mode, syncing, error, resetDemo, exportData } = useStore();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pending = state.inbox.filter((item) => item.status === "unprocessed").length;
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
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className={`app-shell ${aside ? "with-aside" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><TerminalSquare /></span><span>Command</span></div>
        <nav className="side-nav" aria-label="Główna nawigacja">
          {navigation.map(({ to, label, icon: Icon, badge, desktop }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `${isActive ? "active" : ""} ${desktop ? "desktop-only-nav" : ""}`}>
              <Icon /><span>{label}</span>{badge && pending > 0 && <span className="nav-badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row"><span className="avatar">{initials}</span><span><strong>{user?.name}</strong><small>{mode === "demo" ? "Tryb demonstracyjny" : user?.email}</small></span><ChevronDown /></div>
          {mode === "demo" && <button className="sidebar-action" onClick={resetDemo}><RotateCcw /><span>Przywróć demo</span></button>}
          <button className="sidebar-action" onClick={() => void downloadExport()}><Download /><span>Eksportuj dane</span></button>
          {mode === "supabase" && <button className="sidebar-action" onClick={() => void signOut()}><LogOut /><span>Wyloguj się</span></button>}
        </div>
      </aside>

      <header className="topbar">
        <GlobalSearch />
        <div className="top-actions">
          {mode === "demo" ? <span className="demo-pill"><Box /> Tryb demo</span> : <span className={`demo-pill ${error ? "sync-error" : ""}`}>{error ? <CloudOff /> : <Cloud />}{error ? "Błąd synchronizacji" : syncing ? "Synchronizacja…" : "Zsynchronizowano"}</span>}
        </div>
      </header>

      <main className="main-content">{children}</main>
      {aside && <aside className="context-rail">{aside}</aside>}

      <nav className="bottom-nav" aria-label="Nawigacja mobilna">
        <NavLink to="/" end><CalendarDays /><span>Dzisiaj</span></NavLink>
        <NavLink to="/projects"><Folder /><span>Projekty</span></NavLink>
        <button className="capture-fab" onClick={() => navigate("/inbox?capture=true")} aria-label="Szybkie przechwycenie"><Plus /></button>
        <NavLink to="/learning"><BookOpen /><span>Nauka</span></NavLink>
        <NavLink to="/review"><MoreHorizontal /><span>Więcej</span></NavLink>
      </nav>
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
