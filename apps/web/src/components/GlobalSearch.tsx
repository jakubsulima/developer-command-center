import { useEffect, useMemo, useState } from "react";
import { FileClock, Folder, Inbox, Keyboard, Search, Target, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";

interface SearchResult {
  id: string;
  title: string;
  detail: string;
  to: string;
  icon: typeof Folder;
}

export function GlobalSearch() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pl");
  const results = useMemo<SearchResult[]>(() => {
    if (!normalized) return [];
    const candidates: SearchResult[] = [
      ...state.projects.filter((project) => !project.trashedAt).map((project) => ({ id: `project-${project.id}`, title: project.name, detail: project.outcome, to: `/projects/${project.id}`, icon: Folder })),
      ...state.inbox.map((item) => ({ id: `inbox-${item.id}`, title: item.content, detail: item.status === "unprocessed" ? "Inbox • do triage" : "Inbox • rozpatrzone", to: "/inbox", icon: Inbox })),
      ...state.checkpoints.map((item) => ({ id: `checkpoint-${item.id}`, title: item.title, detail: item.nextAction, to: `/projects/${item.projectId}`, icon: FileClock })),
      ...state.evidence.map((item) => ({ id: `evidence-${item.id}`, title: item.title, detail: item.detail, to: "/learning", icon: Target })),
      ...state.knowledge.filter((item) => !item.trashedAt).map((item) => ({ id: `knowledge-${item.id}`, title: item.title, detail: item.detail, to: "/knowledge", icon: FileClock }))
    ];
    return candidates.filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase("pl").includes(normalized)).slice(0, 8);
  }, [normalized, state.checkpoints, state.evidence, state.inbox, state.knowledge, state.projects]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuery("");
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const open = (result: Omit<SearchResult, "icon">) => {
    setQuery("");
    navigate(result.to);
  };

  return <div className="global-search">
    <div className="search-wrap">
      <Search />
      <input id="global-search" type="search" aria-label="Wyszukaj lub wpisz polecenie…" autoComplete="off" placeholder="Wyszukaj lub wpisz polecenie…" value={query} onChange={(event) => setQuery(event.target.value)} />
      {query ? <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery("")}><X /></button> : <kbd><Keyboard /> K</kbd>}
    </div>
    {normalized && <div className="search-results" role="listbox" aria-label="Wyniki wyszukiwania">
      {results.length ? results.map(({ icon: Icon, ...result }) => <button key={result.id} role="option" aria-selected="false" onClick={() => open(result)}><Icon /><span><strong>{result.title}</strong><small>{result.detail}</small></span></button>) : <p>Brak wyników w tym Workspace.</p>}
    </div>}
  </div>;
}
