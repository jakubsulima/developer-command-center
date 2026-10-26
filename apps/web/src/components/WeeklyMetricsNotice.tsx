import { useStore } from "../app/useStore";
import { Button } from "./ui";

export function WeeklyMetricsNotice({ available }: { available: boolean }) {
  const { reload, dataFreshness, syncState } = useStore();
  if (available) return dataFreshness.status === "refreshing" || syncState.pendingCount > 0 ? <p className="muted-copy" role="status">Aktualizuję wyniki tygodnia…</p> : null;
  return <div role="status"><p>Brak aktualnych metryk tego tygodnia.</p><Button variant="ghost" loading={dataFreshness.status === "refreshing"} onClick={() => void reload()}>Ponów odczyt</Button></div>;
}
