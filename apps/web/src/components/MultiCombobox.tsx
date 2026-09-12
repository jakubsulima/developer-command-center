import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "./ui/input";

export interface MultiComboboxOption { id: string; label: string }

export function MultiCombobox({ label, options, value, onChange, disabled = false }: { label: string; options: MultiComboboxOption[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const available = useMemo(() => options.filter((option) => !value.includes(option.id) && option.label.toLocaleLowerCase("pl").includes(query.trim().toLocaleLowerCase("pl"))), [options, query, value]);
  const selected = value.map((id) => options.find((option) => option.id === id)).filter(Boolean) as MultiComboboxOption[];
  const choose = (id: string) => { onChange([...value, id]); setQuery(""); setActive(0); setOpen(false); };
  useEffect(() => {
    if (!open) return;
    const closeOnBlur = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return;
      setOpen(false);
    };
    document.addEventListener("focusin", closeOnBlur);
    return () => document.removeEventListener("focusin", closeOnBlur);
  }, [open]);
  return <div className="multi-combobox" ref={rootRef}>
    <div className="combobox-chips">{selected.map((option) => <span key={option.id}>{option.label}<button type="button" disabled={disabled} aria-label={`Usuń powiązanie: ${option.label}`} onClick={() => onChange(value.filter((id) => id !== option.id))}><X /></button></span>)}</div>
    <Input disabled={disabled} role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && available[active] ? `${listId}-${available[active].id}` : undefined} value={query} placeholder="Wyszukaj i dodaj Cel…" onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((index) => Math.max(0, Math.min(Math.max(available.length - 1, 0), index + 1))); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
      if (event.key === "Enter" && open && available[active]) { event.preventDefault(); choose(available[active].id); }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      if (event.key === "Backspace" && !query && value.length) onChange(value.slice(0, -1));
    }} />
    {open && !disabled ? <div className="combobox-options" id={listId} role="listbox" aria-label={label}>{available.length ? available.map((option, index) => <button type="button" role="option" aria-selected={index === active} id={`${listId}-${option.id}`} key={option.id} onMouseEnter={() => setActive(index)} onClick={() => choose(option.id)}>{option.label}</button>) : <p role="status">Brak wyników.</p>}</div> : null}
  </div>;
}
