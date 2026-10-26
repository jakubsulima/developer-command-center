import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { localDateForTimeZone } from "../domain/activity";
export function KnowledgeRevisitSignal({ now }: { now: Date }) {
  const { state } = useStore();
  const page = useWorkspaceInfinitePage("knowledge", 1, { revisitOnOrBefore: localDateForTimeZone(now, state.workspaceTimezone), knowledgeVisibility: "active" });
  const count = page.data?.totalCount ?? 0;
  return count ? <p className="knowledge-revisit-signal"><Link to="/knowledge?revisit=due">Wiedza do powrotu: {count}</Link></p> : null;
}
