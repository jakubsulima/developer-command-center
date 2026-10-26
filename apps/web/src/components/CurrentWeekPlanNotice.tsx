import type { useCurrentWeekPlan } from "../hooks/useCurrentWeekPlan";
import { Button } from "./ui";

export function CurrentWeekPlanNotice({ read }: { read: ReturnType<typeof useCurrentWeekPlan> }) {
  if (read.error) return <p role="alert">Priorytety Planu tygodnia mogą być nieaktualne. {read.error} <Button variant="ghost" onClick={() => void read.retry()}>Ponów odczyt Planu</Button></p>;
  return read.pending ? <p className="muted-copy" role="status">Wczytuję priorytety Planu tygodnia…</p> : null;
}
