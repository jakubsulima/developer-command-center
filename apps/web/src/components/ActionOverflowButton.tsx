import { MoreHorizontal } from "lucide-react";
import type { GoalAction } from "../domain/types";
import { Button } from "./ui";

export function ActionOverflowButton({ action, busy, onClick }: { action: GoalAction; busy: boolean; onClick: () => void }) {
  return <Button className="mobile-action-more" variant="ghost" aria-label={`Więcej opcji: ${action.title}`} title="Więcej opcji" disabled={busy} onClick={onClick}><MoreHorizontal /></Button>;
}
