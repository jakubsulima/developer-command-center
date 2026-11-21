import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { ActionFilterControl } from "./ActionFilterControl";

type FilterOption<Value extends string> = { value: Value; label: string; count: number; icon: ReactNode };

export function ProjectActionFilterPicker<Value extends string>({ value, label, active, groups, onChange }: {
  value: Value;
  label: string;
  active: boolean;
  groups: { label?: string; options: FilterOption<Value>[] }[];
  onChange: (value: Value) => void;
}) {
  const [open, setOpen] = useState(false);
  return <ActionFilterControl label={label} ariaLabel={`Filtruj Działania. Wybrano: ${label}`} active={active} open={open} onOpenChange={setOpen}>
    {groups.map((group) => <div className="action-filter-group" role={group.label ? "group" : undefined} aria-label={group.label} key={group.label ?? group.options[0]?.value}>
      {group.label ? <h3>{group.label}</h3> : null}
      <div className="action-filter-options">
        {group.options.map((option) => <button key={option.value} className="action-filter-option" type="button" aria-label={`${option.label}: ${option.count}`} aria-pressed={value === option.value} onClick={() => { onChange(option.value); setOpen(false); }}>
          <span className="action-filter-option-icon" aria-hidden="true">{value === option.value ? <Check /> : option.icon}</span>
          <span>{option.label}</span>
          <small>{option.count}</small>
        </button>)}
      </div>
    </div>)}
  </ActionFilterControl>;
}
