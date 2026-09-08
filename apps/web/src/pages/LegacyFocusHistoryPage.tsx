import { ArrowLeft, Clock3, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useStore } from "../app/useStore";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { AppShell } from "../components/AppShell";
import { EmptyState, Panel } from "../components/ui";
import { useMemo } from "react";

export function LegacyFocusHistoryPage() {
  const { state, mode } = useStore();
  const { user } = useAuth();
  const { sessionId } = useParams();
  const localRepository = useMemo(() => createLocalWorkspaceRepository(), []);
  const localSession = state.focusSessions.find((item) => item.id === sessionId);
  const legacyQuery = useQuery({
    queryKey: ["legacy-focus-session", sessionId, mode, user?.id],
    enabled: Boolean(sessionId && !localSession),
    queryFn: async () => (mode === "demo"
      ? await localRepository.loadLegacyFocusSession(sessionId!)
      : await (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository().loadLegacyFocusSession(sessionId!)) ?? null
  });
  const session = localSession ?? legacyQuery.data;
  if (!localSession && legacyQuery.isPending) return <AppShell><EmptyState icon={<History />} title="Ładowanie historii" detail="Pobieram zachowany zapis Focus…" /></AppShell>;
  if (!session) return <AppShell><EmptyState icon={<History />} title="Nie znaleziono historycznego wpisu" detail="Ta dawna sesja nie istnieje w bieżącej przestrzeni pracy." /></AppShell>;
  const goal = state.goals.find((item) => item.id === session.projectId);
  const action = state.actions.find((item) => item.id === session.workItemId);
  const duration = session.endedAt ? Math.max(0, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)) : undefined;
  return <AppShell><Link className="back-link" to={goal ? `/goals/${goal.id}` : "/goals"}><ArrowLeft />Wróć</Link><Panel className="legacy-history"><span className="meta-label">Historia tylko do odczytu</span><h1>{action?.title ?? "Dawna sesja pracy"}</h1><p>{goal?.title}</p><dl><div><dt>Początek</dt><dd>{new Date(session.startedAt).toLocaleString("pl-PL")}</dd></div><div><dt>Koniec</dt><dd>{session.endedAt ? new Date(session.endedAt).toLocaleString("pl-PL") : "Brak zapisanego końca"}</dd></div><div><dt><Clock3 />Czas</dt><dd>{duration !== undefined ? `${duration} min` : "—"}</dd></div></dl><h2>Zachowana treść</h2><pre>{session.scratchpad || "Brak treści."}</pre><p className="muted-copy">Ten zapis nie może już uruchomić timera ani utworzyć nowego wpisu.</p></Panel></AppShell>;
}
