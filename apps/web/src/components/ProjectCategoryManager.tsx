import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "../app/useStore";
import type { ProjectPreset } from "../domain/types";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { categoryColors } from "../domain/projectCategories";

export function ProjectCategoryManager({ onClose }: { onClose: () => void }) {
  const { state, saveProjectCategory, deleteProjectCategory } = useStore();
  const [form, setForm] = useState<{ id: string; name: string; color: string; defaultPreset?: ProjectPreset }>({ id: "", name: "", color: categoryColors[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const run = async (operation: () => Promise<unknown>) => {
    setSaving(true); setError("");
    try { await operation(); setForm({ id: "", name: "", color: categoryColors[0] }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zapisać kategorii."); }
    finally { setSaving(false); }
  };
  return <Modal open title="Kategorie projektów" onClose={onClose} closeDisabled={saving}>
    <p className="modal-intro">Porządkuj projekty po swojemu. Usunięcie kategorii zachowuje wszystkie projekty.</p>
    <ul className="category-manager-list">{(state.projectCategories ?? []).map((category) => <li key={category.id}><span className="category-dot" style={{ backgroundColor: category.color }} /><strong>{category.name}</strong><small>{category.defaultPreset === "reading" ? "Czytelnia" : category.defaultPreset === "standard" ? "Standardowy" : "Bez propozycji"}</small><small>{state.areas.filter((area) => area.categoryIds?.includes(category.id)).length}</small><Button disabled={saving} variant="ghost" aria-label={`Edytuj kategorię ${category.name}`} onClick={() => setForm(category)}><Pencil /></Button><Button disabled={saving} variant="ghost" aria-label={`Usuń kategorię ${category.name}`} onClick={() => void run(() => deleteProjectCategory(category.id))}><Trash2 /></Button></li>)}</ul>
    <form className="project-create-form" onSubmit={(event) => { event.preventDefault(); void run(() => saveProjectCategory(form.id || undefined, form.name, form.color, form.defaultPreset)); }}>
      <label className="field-label" htmlFor="category-name">{form.id ? "Zmień nazwę kategorii" : "Nowa kategoria"}</label>
      <input id="category-name" required maxLength={100} value={form.name} placeholder="Np. Pomysły na produkty" onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <label className="field-label" htmlFor="category-default-preset">Proponowany szablon Projektu <span className="optional-label">opcjonalnie</span></label>
      <select id="category-default-preset" value={form.defaultPreset ?? ""} onChange={(event) => setForm({ ...form, defaultPreset: event.target.value ? event.target.value as ProjectPreset : undefined })}><option value="">Bez propozycji</option><option value="standard">Standardowy</option><option value="reading">Czytelnia</option></select>
      <div className="category-color-options" role="group" aria-label="Kolor kategorii">{categoryColors.map((color, i) => <button key={color} type="button" aria-label={`Kolor ${i + 1}`} aria-pressed={form.color === color} style={{ backgroundColor: color }} onClick={() => setForm({ ...form, color })} />)}</div>
      {error ? <p role="alert" className="auth-message error">{error}</p> : null}
      <div className="modal-actions"><Button type="button" disabled={saving} onClick={onClose}>Zamknij</Button><Button type="submit" loading={saving} disabled={!form.name.trim()} variant="primary"><Plus />{form.id ? "Zapisz kategorię" : "Dodaj kategorię"}</Button></div>
    </form>
  </Modal>;
}
