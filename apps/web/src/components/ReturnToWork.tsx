import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import { useEffect, useState } from "react";
import { ArrowUpRight, History } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useStore } from "../app/useStore";

type Recent = { path: string; title: string };
function readRecent(key: string): Recent | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value && typeof value === "object" && "path" in value && "title" in value && typeof value.path === "string" && /^\/(projects|actions|knowledge)\/[^/?#]+$/.test(value.path) && typeof value.title === "string") return value as Recent;
  } catch { /* An optional shortcut must never prevent work. */ }
}
export function RecentWorkTracker() {
  const { pathname } = useLocation();
  const { state, mode } = useStore();
  const { user } = useAuth();
  const id = pathname.split("/")[2];
  const entity = pathname.startsWith("/projects/") ? state.areas.find((item) => item.id === id && item.visibility === "active") : pathname.startsWith("/actions/") ? state.actions.find((item) => item.id === id && !["completed", "cancelled", "skipped"].includes(item.status)) : pathname.startsWith("/knowledge/") ? state.knowledge.find((item) => item.id === id && !item.archivedAt && !item.trashedAt) : undefined;
  const title = entity ? "name" in entity ? entity.name : entity.title : undefined;
  useEffect(() => {
    if (!title || !user || (!state.workspaceId && mode !== "demo")) return;
    try { localStorage.setItem(`command-recent:${user.id}:${state.workspaceId ?? "demo-workspace"}`, JSON.stringify({ path: pathname, title })); } catch { /* Optional history. */ }
  }, [pathname, title, user, state.workspaceId, mode]);
  return null;
}
export function ReturnToWork() {
  const { user } = useAuth();
  const { state, mode } = useStore();
  const [recent, setRecent] = useState<Recent>();
  useEffect(() => {
    let active = true;
    setRecent(undefined);
    const value = readRecent(`command-recent:${user?.id}:${state.workspaceId ?? "demo-workspace"}`);
    if (!value) return;
    const id = value.path.split("/")[2]!;
    const check = async () => {
      if (value.path.startsWith("/projects/")) return state.areas.some((item) => item.id === id && item.visibility === "active");
      if (value.path.startsWith("/actions/")) { const item = mode === "demo" ? state.actions.find((item) => item.id === id) : await createSupabaseWorkspaceRepository().loadAction(id); return item && !["completed", "cancelled", "skipped"].includes(item.status); }
      const item = mode === "demo" ? state.knowledge.find((item) => item.id === id) : await createSupabaseWorkspaceRepository().loadKnowledgeItem(id);
      return item && !item.archivedAt && !item.trashedAt;
    };
    void check().then((available) => { if (active && available) setRecent(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [mode, state.actions, state.areas, state.knowledge, state.workspaceId, user?.id]);
  return recent ? <Link className="return-to-work" to={recent.path}><History /><span><small>Wróć do pracy</small><strong>{recent.title}</strong></span><ArrowUpRight /></Link> : null;
}
