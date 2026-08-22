import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Flag, FolderKanban, Inbox, ListChecks, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { routeForEntity } from "../domain/routes";
import { describeActionContext, resolveActionContext } from "../domain/actionContext";
import { GLOBAL_SEARCH_STORAGE_KEY } from "../auth/private-browser-state";
import { Input } from "./ui/input";

type SearchGroup = "Projekty" | "Cele" | "Działania" | "Wiedza" | "Skrzynka";

interface SearchResult { id: string; title: string; detail: string; to: string; group: SearchGroup; icon: typeof Flag }

function normalizeSearchText(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pl");
}

export function GlobalSearch({ id = "global-search", onNavigate }: { id?: string; onNavigate?: () => void }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(() => sessionStorage.getItem(GLOBAL_SEARCH_STORAGE_KEY) ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const normalized = normalizeSearchText(query);
  const results = useMemo<SearchResult[]>(() => {
    const candidates: SearchResult[] = [
      ...state.areas.filter((project) => project.visibility === "active").map((project) => ({ id: `project-${project.id}`, title: project.name, detail: project.description || "Stały kontekst pracy", to: `/projects/${project.id}`, group: "Projekty" as const, icon: FolderKanban })),
      ...state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: `goal-${goal.id}`, title: goal.title, detail: goal.outcome, to: routeForEntity({ type: "goal", id: goal.id }), group: "Cele" as const, icon: Flag })),
      ...state.actions.filter((action) => !["cancelled", "completed"].includes(action.status)).map((action) => { const context = resolveActionContext(action, state); return { id: `action-${action.id}`, title: action.title, detail: describeActionContext(context), to: routeForEntity({ type: "action", id: action.id, goalId: action.goalId }), group: "Działania" as const, icon: ListChecks }; }),
      ...state.knowledge.filter((item) => !item.trashedAt && !item.archivedAt).map((item) => ({ id: `knowledge-${item.id}`, title: item.title, detail: item.detail, to: routeForEntity({ type: "knowledge", id: item.id }), group: "Wiedza" as const, icon: Archive })),
      ...state.inbox.map((item) => ({ id: `inbox-${item.id}`, title: item.content, detail: item.status === "unprocessed" ? "Czeka na decyzję" : "Historia Skrzynki", to: routeForEntity({ type: "inbox", id: item.id, status: item.status }), group: "Skrzynka" as const, icon: Inbox }))
    ];
    if (!normalized) return [];
    return candidates.filter((item) => normalizeSearchText(`${item.title} ${item.detail}`).includes(normalized)).slice(0, 8);
  }, [normalized, state]);
  const resultsId = `${id}-results`;
  const choose = (result: SearchResult) => { setOpen(false); navigate(result.to); onNavigate?.(); };

  useEffect(() => { setActive(0); }, [query]);
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
    {open && normalized && <div id={resultsId} className="search-results" role="listbox" aria-label="Wyniki wyszukiwania">{results.length ? <>
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
