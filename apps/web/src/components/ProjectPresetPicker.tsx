import type { ProjectCategory, ProjectPreset } from "../domain/types";
import { categoryPresetSuggestion, projectPresets } from "../domain/projectPresets";

export function ProjectPresetPicker({ value, categories, categoryIds, onChange, disabled = false }: {
  value: ProjectPreset;
  categories: ProjectCategory[];
  categoryIds: string[];
  onChange: (preset: ProjectPreset) => void;
  disabled?: boolean;
}) {
  const suggestion = categoryPresetSuggestion(categories, categoryIds);
  const suggestedLabel = projectPresets[suggestion.preset].label;
  return <div className="project-preset-field">
    <label className="field-label" htmlFor="project-preset">Szablon Projektu</label>
    <select id="project-preset" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as ProjectPreset)}>
      {Object.values(projectPresets).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
    </select>
    <small role={suggestion.conflict ? "status" : undefined}>{suggestion.conflict
      ? "Wybrane kategorie proponują różne szablony. Domyślnie wybrano Standardowy."
      : `Propozycja kategorii: ${suggestedLabel}. Możesz wybrać inny szablon.`}</small>
  </div>;
}
