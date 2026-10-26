import { useQuery } from "@tanstack/react-query";
import { useStore } from "../app/useStore";
import { workspaceWeekBounds } from "../domain/activity";
import type { ReviewRecord } from "../domain/types";

export function selectCurrentWeekPlan(reviews: ReviewRecord[], startDate: string, timeZone: string) {
  return reviews.filter((review) => review.snapshot?.plan.startDate === startDate && review.workspaceTimezone === timeZone)
    .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0) || b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id))[0];
}

export function useCurrentWeekPlan(now = new Date()) {
  const { state, mode } = useStore();
  const { startDate } = workspaceWeekBounds(now, state.workspaceTimezone);
  const local = selectCurrentWeekPlan(state.reviews, startDate, state.workspaceTimezone);
  const query = useQuery({
    queryKey: ["workspace-current-plan", state.workspaceId, startDate, state.workspaceTimezone],
    enabled: mode === "supabase" && Boolean(state.workspaceId),
    queryFn: async (): Promise<ReviewRecord | null> => {
      const { getSupabase } = await import("../lib/supabase");
      const { data, error } = await getSupabase().from("reviews").select("id,completed_at,revision,snapshot,workspace_timezone")
        .eq("workspace_id", state.workspaceId!).eq("snapshot->plan->>startDate", startDate)
        .eq("workspace_timezone", state.workspaceTimezone).order("revision", { ascending: false }).order("completed_at", { ascending: false }).order("id", { ascending: false }).limit(1);
      if (error?.code === "42703" || error?.code === "PGRST204") throw new Error("Baza wymaga migracji obsługi Planu tygodnia z 27 września.");
      if (error) throw new Error("Nie udało się odczytać bieżącego Planu.");
      const row = data?.[0];
      return row ? { id: row.id, type: "weekly", templateVersion: 1, answers: {}, summary: "", completedAt: row.completed_at, revision: row.revision, workspaceTimezone: row.workspace_timezone, snapshot: row.snapshot } : null;
    },
  });
  const plan = mode === "demo" ? local : selectCurrentWeekPlan([...(query.data ? [query.data] : []), ...(local ? [local] : [])], startDate, state.workspaceTimezone);
  return { plan, pending: mode === "supabase" && Boolean(state.workspaceId) && query.isPending, error: query.isError ? query.error.message : undefined, retry: query.refetch };
}
