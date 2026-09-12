import { FileText, GitBranch, Library } from "lucide-react";
import { creatableKnowledgeKinds, knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";

const icons = { note: FileText, resource: Library, decision: GitBranch } as const;

export function KnowledgeKindPicker({ value, onChange, name = "knowledge-kind", disabled = false }: {
  value: CreatableKnowledgeKind;
  onChange: (kind: CreatableKnowledgeKind) => void;
  name?: string;
  disabled?: boolean;
}) {
  return <fieldset className="knowledge-kind-picker">
    <legend>Co zapisujesz?</legend>
    <div>
      {creatableKnowledgeKinds.map((kind) => {
        const Icon = icons[kind];
        const guidance = knowledgeKindGuidance[kind];
        return <label key={kind}>
          <input type="radio" name={name} value={kind} checked={value === kind} disabled={disabled} onChange={() => onChange(kind)} />
          <span className={"knowledge-kind-picker-icon knowledge-kind-" + kind}><Icon aria-hidden="true" /></span>
          <span><strong>{guidance.label}</strong><small>{guidance.description}</small></span>
        </label>;
      })}
    </div>
    <p key={value} className="knowledge-kind-picker-description" aria-live="polite">
      {knowledgeKindGuidance[value].description}
    </p>
  </fieldset>;
}
