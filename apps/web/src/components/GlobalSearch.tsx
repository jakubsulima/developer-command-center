import { useEffect, useRef, useState } from "react";
import { Archive, Flag, FolderKanban, Inbox, ListChecks, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { GLOBAL_SEARCH_STORAGE_KEY } from "../auth/private-browser-state";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type SearchGroup = "Projekty" | "Cele" | "Działania" | "Wiedza" | "Skrzynka";

interface SearchResult { id: string; title: string; detail: string; to: string; group: SearchGroup; icon: typeof Flag }

type SearchState = { query: string; search: ReturnType<typeof useStore>["search"] } & (
  | { status: "loading" | "error" }
  | { status: "success"; results: SearchResult[] }
);

export function GlobalSearch({ id = "global-search", onNavigate, visible = true }: { id?: string; onNavigate?: () => void; visible?: boolean }) {
  const { search } = useStore();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(() => sessionStorage.getItem(GLOBAL_SEARCH_STORAGE_KEY) ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<SearchState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retryLocked = useRef(false);
  const normalized = query.trim();
  const expanded = open && visible && normalized.length > 0;
  const current = state?.query === normalized && state.search === search ? state : null;
  const status = !normalized ? "empty" : normalized.length < 2 ? "short" : current?.status ?? "loading";
  const results = expanded && status === "success" && current?.status === "success" ? current.results : [];
  const resultsId = `${id}-results`;
  const choose = (result: SearchResult) => { setOpen(false); navigate(result.to); onNavigate?.(); };

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (!open || !visible || normalized.length < 2) { setState(null); return; }
    let activeRequest = true;
    retryLocked.current = true;
    setState({ query: normalized, search, status: "loading" });
    const timer = window.setTimeout(() => {
      void search(normalized, 20).then((items) => {
        if (!activeRequest) return;
        setState({ query: normalized, search, status: "success", results: items.map((item) => ({
          id: `${item.type}-${item.id}`,
          title: item.title,
          detail: item.detail ?? "",
          to: item.route,
          group: item.type === "project" ? "Projekty" : item.type === "goal" ? "Cele" : item.type === "action" ? "Działania" : item.type === "knowledge" ? "Wiedza" : "Skrzynka",
          icon: item.type === "project" ? FolderKanban : item.type === "goal" ? Flag : item.type === "action" ? ListChecks : item.type === "knowledge" ? Archive : Inbox
        })) });
        retryLocked.current = false;
      }).catch(() => {
        if (!activeRequest) return;
        retryLocked.current = false;
        setState({ query: normalized, search, status: "error" });
      });
    }, 200);
    return () => { activeRequest = false; window.clearTimeout(timer); };
  }, [normalized, search, open, visible, attempt]);
  useEffect(() => { if (query) sessionStorage.setItem(GLOBAL_SEARCH_STORAGE_KEY, query); else sessionStorage.removeItem(GLOBAL_SEARCH_STORAGE_KEY); }, [query]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  let resultIndex = 0;
  return <div ref={rootRef} className="global-search">
    <div className="search-wrap"><Search /><Input id={id} role="combobox" aria-label="Szukaj w Projektach, Celach, Działaniach i Wiedzy" aria-expanded={expanded} aria-controls={results.length ? resultsId : undefined} aria-describedby={expanded && !results.length ? `${id}-status` : undefined} aria-activedescendant={expanded && results[active] ? `${id}-${results[active].id}` : undefined} autoComplete="off" placeholder="Szukaj…" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => results.length ? Math.min(results.length - 1, value + 1) : 0); } if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); } if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); } if (event.key === "Escape") { setOpen(false); setQuery(""); event.currentTarget.blur(); } }} />{query ? <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery("")}><X /></button> : null}</div>
    {expanded && <div className="search-results">
      {results.length ? <>
        <div className="search-results-summary" role="status"><span>Wyniki</span><strong>{results.length}</strong></div>
        <div id={resultsId} className="search-result-list" role="listbox" aria-label="Wyniki wyszukiwania">
          {results.map(({ icon: Icon, ...result }) => {
            const index = resultIndex++;
            return <button id={`${id}-${result.id}`} key={result.id} role="option" aria-label={`${result.title} — ${result.group}`} aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose({ ...result, icon: Icon })}><span className="search-result-icon"><Icon /></span><span className="search-result-copy"><strong>{result.title}</strong><small>{result.group} · {result.detail}</small></span></button>;
          })}
        </div>
      </> : <div className="search-empty">
        <Search />
        <div id={`${id}-status`} role="status" aria-live="polite">
          <strong>{status === "short" ? "Wpisz co najmniej 2 znaki" : status === "loading" ? "Szukanie…" : status === "error" ? "Nie udało się wyszukać. Spróbuj ponownie." : "Brak wyników"}</strong>
          {status === "success" && <p>Spróbuj krótszej frazy.</p>}
        </div>
        {status === "error" && <Button type="button" onClick={() => {
          if (retryLocked.current) return;
          retryLocked.current = true;
          setActive(0);
          setState({ query: normalized, search, status: "loading" });
          setAttempt((value) => value + 1);
          document.getElementById(id)?.focus();
        }}>Ponów</Button>}
      </div>}
    </div>}
  </div>;
}
