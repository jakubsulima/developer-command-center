import { useEffect, useMemo, useState } from "react";
import { Archive, Flag, FolderKanban, Inbox, Keyboard, ListChecks, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { routeForEntity } from "../domain/routes";

interface SearchResult { id: string; title: string; detail: string; to: string; group: "Projekty" | "Cele" | "Zadania" | "Wiedza" | "Inbox"; icon: typeof Flag }

export function GlobalSearch({ id = "global-search", onNavigate }: { id?: string; onNavigate?: () => void }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => sessionStorage.getItem("command-global-search") ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const normalized = query.trim().toLocaleLowerCase("pl");
  const results = useMemo<SearchResult[]>(() => {
    const candidates: SearchResult[] = [
      ...state.areas.filter((project) => project.visibility === "active").map((project) => ({ id: `project-${project.id}`, title: project.name, detail: project.description || "Stały kontekst pracy", to: `/projects/${project.id}`, group: "Projekty" as const, icon: FolderKanban })),
      ...state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: `goal-${goal.id}`, title: goal.title, detail: goal.outcome, to: routeForEntity({ type: "goal", id: goal.id }), group: "Cele" as const, icon: Flag })),
      ...state.actions.filter((action) => !["cancelled", "completed"].includes(action.status)).map((action) => ({ id: `action-${action.id}`, title: action.title, detail: state.goals.find((goal) => goal.id === action.goalId)?.title ?? "Samodzielne Zadanie", to: routeForEntity({ type: "action", id: action.id, goalId: action.goalId }), group: "Zadania" as const, icon: ListChecks })),
      ...state.knowledge.filter((item) => !item.trashedAt && !item.archivedAt).map((item) => ({ id: `knowledge-${item.id}`, title: item.title, detail: item.detail, to: routeForEntity({ type: "knowledge", id: item.id }), group: "Wiedza" as const, icon: Archive })),
      ...state.inbox.map((item) => ({ id: `inbox-${item.id}`, title: item.content, detail: item.status === "unprocessed" ? "Czeka na decyzję" : "Historia Inboxu", to: routeForEntity({ type: "inbox", id: item.id, status: item.status }), group: "Inbox" as const, icon: Inbox }))
    ];
    const matched = normalized ? candidates.filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase("pl").includes(normalized)) : candidates;
    return matched.slice(0, 12);
  }, [normalized, state.actions, state.areas, state.goals, state.inbox, state.knowledge]);
  const resultsId = `${id}-results`;
  const choose = (result: SearchResult) => { setOpen(false); navigate(result.to); onNavigate?.(); };

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { if (query) sessionStorage.setItem("command-global-search", query); else sessionStorage.removeItem("command-global-search"); }, [query]);
  return <div className="global-search">
    <div className="search-wrap"><Search /><input id={id} role="combobox" aria-label="Szukaj w Projektach, Celach, Zadaniach i Wiedzy" aria-expanded={open} aria-controls={resultsId} aria-activedescendant={open && results[active] ? `${id}-${results[active].id}` : undefined} autoComplete="off" placeholder="Szukaj w Projektach, Celach, Zadaniach i Wiedzy…" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); } if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); } if (event.key === "Escape") { setOpen(false); setQuery(""); event.currentTarget.blur(); } }} />{query ? <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery("")}><X /></button> : <kbd><Keyboard /> K</kbd>}</div>
    {open && <div id={resultsId} className="search-results" role="listbox" aria-label="Wyniki wyszukiwania">{results.length ? results.map(({ icon: Icon, ...result }, index) => <button id={`${id}-${result.id}`} key={result.id} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose({ ...result, icon: Icon })}><Icon /><span><small>{result.group}</small><strong>{result.title}</strong><small>{result.detail}</small></span></button>) : <p>Brak wyników. Możesz utworzyć nowy Projekt, Cel, Zadanie albo element Wiedzy.</p>}</div>}
  </div>;
}
