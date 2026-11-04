import { useStore } from "../app/useStore";
import { goalKindLabels } from "../domain/labels";
import type { GoalKind } from "../domain/types";
import type { QuickAddDraft } from "./creationDraft";

export function GoalCreationOptions({ value, onChange }: { value: QuickAddDraft; onChange: (value: QuickAddDraft) => void }) {
  const { state } = useStore();
  return <details className="advanced-options"><summary>Więcej opcji <span className="optional-label">rodzaj, szablon, pierwszy krok i kryteria</span></summary><div className="creation-fields">
    <label className="field-label" htmlFor="goal-kind">Rodzaj Celu</label><select id="goal-kind" value={value.goalKind ?? "custom"} onChange={(event) => onChange({ ...value, goalKind: event.target.value as GoalKind, goalTemplateId: undefined })}>{Object.entries(goalKindLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    <label className="field-label" htmlFor="goal-template">Własny szablon</label><select id="goal-template" value={value.goalTemplateId ?? ""} onChange={(event) => { const template = state.goalTemplates.find((item) => item.id === event.target.value); onChange({ ...value, goalTemplateId: template?.id, goalKind: template?.kind ?? value.goalKind, firstActionTitle: value.firstActionTitle || template?.defaultActions[0]?.title || "" }); }}><option value="">Bez szablonu</option>{state.goalTemplates.filter((item) => item.visibility === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <label className="field-label" htmlFor="goal-first-action">Jaki jest pierwszy krok? <span className="optional-label">opcjonalnie</span></label><input id="goal-first-action" value={value.firstActionTitle ?? ""} onChange={(event) => onChange({ ...value, firstActionTitle: event.target.value })} />
    <label className="field-label" htmlFor="goal-criteria">Kryteria sukcesu <span className="optional-label">jedno w linii</span></label><textarea id="goal-criteria" rows={3} value={value.goalCriteria ?? ""} onChange={(event) => onChange({ ...value, goalCriteria: event.target.value })} />
  </div></details>;
}
