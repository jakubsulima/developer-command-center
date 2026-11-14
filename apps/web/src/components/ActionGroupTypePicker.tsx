import { useId } from "react";
import { actionGroupTypeLabels } from "../domain/actionGroups";
import type { ActionGroupType } from "../domain/types";
import "./action-groups.css";

export function ActionGroupTypePicker({ value, onChange, disabled, conversionBlocker }: {
  value: ActionGroupType; onChange: (value: ActionGroupType) => void; disabled?: boolean; conversionBlocker?: string;
}) {
  const id = useId();
  return <div className="action-group-type-field">
    <label className="field-label" htmlFor={id}>Typ grupy</label>
    <select id={id} value={value} disabled={disabled} aria-describedby={`${id}-help`} onChange={(event) => onChange(event.target.value as ActionGroupType)}>
      {Object.entries(actionGroupTypeLabels).map(([type, label]) => <option key={type} value={type} disabled={type === "category" && Boolean(conversionBlocker)}>{label}</option>)}
    </select>
    <p className="muted-copy" id={`${id}-help`}>{conversionBlocker ?? (value === "category" ? "Stały temat, np. UI/UX lub Wydajność. Możesz stale dodawać nowe Działania." : "Praca z Działaniami pod sobą. Całość zamykasz osobno po jej wykonaniu.")}</p>
  </div>;
}
