import { useStore } from "../app/useStore";
import { Button } from "./ui";

/** Materials are explicit relationships, independent of Project or Goal. */
export function CreationMaterialsContext({ ids, disabled, onRemove }: { ids: string[]; disabled?: boolean; onRemove: (id: string) => void }) {
  const { state } = useStore();
  return <>{ids.map((id) => {
    const title = state.knowledge.find((item) => item.id === id)?.title ?? "Niedostępny materiał";
    return <p className="quick-add-context-summary" key={id}><strong>Materiał: </strong><span>{title}</span> <Button type="button" variant="ghost" disabled={disabled} aria-label={`Odłącz materiał: ${title}`} onClick={() => onRemove(id)}>Odłącz</Button></p>;
  })}</>;
}
