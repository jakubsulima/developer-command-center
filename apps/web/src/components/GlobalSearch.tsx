import { useEffect, useRef, useState } from "react";
import { Archive, Flag, FolderKanban, Inbox, ListChecks, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { GLOBAL_SEARCH_STORAGE_KEY } from "../auth/private-browser-state";
import { Input } from "./ui/input";

type SearchGroup = "Projekty" | "Cele" | "Działania" | "Wiedza" | "Skrzynka";

interface SearchResult { id: string; title: string; detail: string; to: string; group: SearchGroup; icon: typeof Flag }

export function GlobalSearch({ id = "global-search", onNavigate }: { id?: string; onNavigate?: () => void }) {
  const { search } = useStore();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(() => sessionStorage.getItem(GLOBAL_SEARCH_STORAGE_KEY) ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const normalized = query.trim();
  const resultsId = `${id}-results`;
  const choose = (result: SearchResult) => { setOpen(false); navigate(result.to); onNavigate?.(); };

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (normalized.length < 2) { setResults([]); setSearching(false); return; }
    let activeRequest = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void search(normalized, 20).then((items) => {
        if (!activeRequest) return;
        setResults(items.map((item) => ({
          id: `${item.type}-${item.id}`,
          title: item.title,
          detail: item.detail ?? "",
          to: item.route,
          group: item.type === "project" ? "Projekty" : item.type === "goal" ? "Cele" : item.type === "action" ? "Działania" : item.type === "knowledge" ? "Wiedza" : "Skrzynka",
          icon: item.type === "project" ? FolderKanban : item.type === "goal" ? Flag : item.type === "action" ? ListChecks : item.type === "knowledge" ? Archive : Inbox
        })));
      }).catch(() => { if (activeRequest) setResults([]); }).finally(() => { if (activeRequest) setSearching(false); });
    }, 200);
    return () => { activeRequest = false; window.clearTimeout(timer); };
  }, [normalized, search]);
  useEffect(() => { if (query) sessionStorage.setItem(GLOBAL_SEARCH_STORAGE_KEY, query); else sessionStorage.removeItem(GLOBAL_SEARCH_STORAGE_KEY); }, [query]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  let resultIndex = 0;
  return <div ref={rootRef} className="global-search">
    <div className="search-wrap"><Search /><Input id={id} role="combobox" aria-label="Szukaj w Projektach, Celach, Działaniach i Wiedzy" aria-expanded={open} aria-controls={resultsId} aria-activedescendant={open && results[active] ? `${id}-${results[active].id}` : undefined} autoComplete="off" placeholder="Szukaj…" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => results.length ? Math.min(results.length - 1, value + 1) : 0); } if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); } if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); } if (event.key === "Escape") { setOpen(false); setQuery(""); event.currentTarget.blur(); } }} />{query ? <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery("")}><X /></button> : null}</div>
    {open && normalized && <div id={resultsId} className="search-results" role="listbox" aria-label="Wyniki wyszukiwania">{searching ? <div className="search-empty" role="status"><Search /><strong>Szukanie…</strong></div> : results.length ? <>
      <div className="search-results-summary" role="status"><span>Wyniki</span><strong>{results.length}</strong></div>
      <div className="search-result-list">
        {results.map(({ icon: Icon, ...result }) => {
          const index = resultIndex++;
          return <button id={`${id}-${result.id}`} key={result.id} role="option" aria-label={`${result.title} — ${result.group}`} aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose({ ...result, icon: Icon })}><span className="search-result-icon"><Icon /></span><span className="search-result-copy"><strong>{result.title}</strong><small>{result.group} · {result.detail}</small></span></button>;
        })}
      </div>
    </> : <div className="search-empty"><Search /><strong>Brak wyników</strong><p>Spróbuj krótszej frazy.</p></div>}</div>}
  </div>;
}
