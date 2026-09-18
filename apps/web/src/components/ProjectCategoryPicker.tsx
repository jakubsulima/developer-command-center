import { useState } from "react";
import { Plus, Tag } from "lucide-react";
import { useStore } from "../app/useStore";
import { Button } from "./ui";
import "./ProjectCategories.css";

import { categoryColors } from "../domain/projectCategories";

export function ProjectCategoryPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { state, saveProjectCategory } = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true); setError("");
    try { const id = await saveProjectCategory(undefined, name, categoryColors[0]); onChange([...value, id]); setName(""); setCreating(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się dodać kategorii."); }
    finally { setSaving(false); }
  };
  return <fieldset className="project-category-picker"><legend><Tag size={15} />Kategorie <small>możesz wybrać kilka</small></legend>
    <div className="project-category-options">{(state.projectCategories ?? []).map((category) => <label key={category.id} className={`project-category-chip ${value.includes(category.id) ? "selected" : ""}`}><input type="checkbox" checked={value.includes(category.id)} onChange={(event) => onChange(event.target.checked ? [...value, category.id] : value.filter((id) => id !== category.id))} /><span style={{ backgroundColor: category.color }} />{category.name}</label>)}
      <Button type="button" variant="ghost" onClick={() => setCreating(!creating)}><Plus />Nowa kategoria</Button>
    </div>
    {creating ? <div className="category-inline-create"><input aria-label="Nazwa nowej kategorii" maxLength={100} placeholder="Np. Rozwój zawodowy" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void create(); } }} /><Button type="button" loading={saving} disabled={!name.trim()} onClick={() => void create()}>Dodaj</Button></div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </fieldset>;
}
