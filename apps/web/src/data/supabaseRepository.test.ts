import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureRemote, completeReviewRemote, createLearningGoalRemote, createProjectRemote,
  decideAIProposalRemote, endFocusRemote, exportWorkspaceRemote, loadSupabaseState,
  recordLearningEvidenceRemote, resolveInboxRemote, setCommitmentStatusRemote, setEntityVisibilityRemote,
  setInboxStatusRemote, setLearningGoalStatusRemote, startFocusRemote, updateScratchpadRemote
} from "./supabaseRepository";

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("../lib/supabase", () => ({ getSupabase: getClient }));

type Result = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(
  tableData: Record<string, unknown> = {},
  rpcData: Record<string, unknown> = {},
  selectResults: Record<string, Record<string, Result>> = {}
) {
  const calls: Array<{ kind: string; name: string; args?: unknown }> = [];
  const result = (data: unknown): Result => ({ data, error: null });
  const from = vi.fn((table: string) => {
    let response = result(Object.hasOwn(tableData, table) ? tableData[table] : []);
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn((...args: unknown[]) => {
      calls.push({ kind: "select", name: table, args });
      const selected = selectResults[table]?.[String(args[0])];
      if (selected) response = selected;
      return builder;
    });
    for (const method of ["is", "in", "order", "limit", "eq"]) builder[method] = vi.fn((...args: unknown[]) => { calls.push({ kind: method, name: table, args }); return builder; });
    builder.update = vi.fn((args: unknown) => { calls.push({ kind: "update", name: table, args }); return builder; });
    builder.insert = vi.fn((args: unknown) => { calls.push({ kind: "insert", name: table, args }); return builder; });
    builder.maybeSingle = vi.fn(async () => response);
    builder.single = vi.fn(async () => response);
    builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(response).then(resolve);
    builder.setResult = (next: Result) => { response = next; };
    return builder;
  });
  const rpc = vi.fn(async (name: string, args: unknown) => { calls.push({ kind: "rpc", name, args }); return result(rpcData[name] ?? {}); });
  return { from, rpc, calls };
}

const workspaceId = "10000000-0000-0000-0000-000000000001";
const projectId = "10000000-0000-0000-0000-000000000010";
const workItemId = "10000000-0000-0000-0000-000000000011";

describe("repozytorium Supabase", () => {
  beforeEach(() => { getClient.mockReset(); });

  it("buduje spójną projekcję Workspace z rekordów chronionych przez RLS", async () => {
    const client = fakeClient({
      workspace_members: { workspace_id: workspaceId },
      entities: [
        { id: projectId, type: "project", title: "Command" },
        { id: workItemId, type: "work_item", title: "Zbuduj przepływ" },
        { id: "goal", type: "learning_goal", title: "Testowanie" },
        { id: "skill", type: "skill", title: "Vitest" },
        { id: "note", type: "note", title: "Notatka" }
      ],
      projects: [{ entity_id: projectId, outcome: "Działający produkt", constraints_md: "Technologie: React", status: "shaped" }],
      requirements: [{ entity_id: "req", project_id: projectId, description: "RLS", status: "accepted" }],
      commitments: [{ id: "commitment", target_entity_id: projectId, status: "active", is_primary: true, effort_budget_minutes: 120 }],
      work_items: [{ entity_id: workItemId, primary_context_entity_id: projectId, description: "Opis", status: "in_progress", blocker: null }],
      inbox_items: [{ id: "inbox", kind: "text", raw_content: "Pomysł", status: "unprocessed", created_at: "2026-08-01T08:00:00Z" }],
      focus_sessions: [{ id: "session", work_item_id: workItemId, started_at: "2026-08-01T08:00:00Z", ended_at: null, scratchpad: "kontekst" }],
      context_checkpoints: [],
      learning_evidence: [],
      learning_goals: [{ entity_id: "goal", demonstration_criterion: "Napisz test", status: "shaped" }],
      skills: [{ entity_id: "skill" }],
      learning_goal_skills: [{ learning_goal_id: "goal", skill_id: "skill" }],
      ai_proposals: [{ id: "proposal", status: "pending", created_at: "2026-08-01T08:00:00Z" }],
      reviews: []
    });
    getClient.mockReturnValue(client);

    const state = await loadSupabaseState("user-1");
    expect(state.workspaceId).toBe(workspaceId);
    expect(state.projects[0]).toMatchObject({ name: "Command", technology: "React", primary: true, nextStep: "Zbuduj przepływ" });
    expect(state.focus).toMatchObject({ running: true, sessionId: "session", workItemId, scratchpad: "kontekst" });
    expect(state.learningGoals[0]).toMatchObject({ title: "Testowanie", skills: ["Vitest"] });
    expect(state.knowledge[0]).toMatchObject({ type: "note", title: "Notatka" });
  });

  it("zwraca czytelny błąd, gdy użytkownik nie ma Workspace", async () => {
    const client = fakeClient({ workspace_members: null });
    getClient.mockReturnValue(client);
    await expect(loadSupabaseState("user-without-workspace")).rejects.toThrow("brak danych");
  });

  it("odczytuje Workspace ze starszego schematu Inbox, zanim migracja zostanie wdrożona", async () => {
    const legacyInbox = [{ id: "legacy-inbox", kind: "text", raw_content: "Pomysł", status: "unprocessed", created_at: "2026-08-01T08:00:00Z" }];
    const client = fakeClient(
      { workspace_members: { workspace_id: workspaceId } },
      {},
      {
        inbox_items: {
          "id,kind,raw_content,status,created_at,snoozed_until,discarded_at": { data: null, error: { code: "42703", message: "column inbox_items.snoozed_until does not exist" } },
          "id,kind,raw_content,status,created_at": { data: legacyInbox, error: null }
        }
      }
    );
    getClient.mockReturnValue(client);

    const state = await loadSupabaseState("user-1");

    expect(state.inbox).toEqual([expect.objectContaining({ id: "legacy-inbox", status: "unprocessed" })]);
    expect(client.calls.filter((call) => call.kind === "select" && call.name === "inbox_items")).toHaveLength(2);
  });

  it("realizuje wszystkie publiczne komendy zdalne i zachowuje ich wyniki", async () => {
    const client = fakeClient({ workspaces: { id: workspaceId, name: "Osobiste" } }, {
      capture_item: { id: "captured", kind: "link", raw_content: "https://example.com", created_at: "2026-08-01T08:00:00Z" },
      start_focus_session: { id: "session", started_at: "2026-08-01T08:00:00Z" },
      create_shaped_project: projectId,
      create_learning_goal: "goal"
    });
    getClient.mockReturnValue(client);

    expect(await captureRemote(workspaceId, "https://example.com", "link", "key")).toMatchObject({ id: "captured", kind: "link" });
    expect(await startFocusRemote(workspaceId, workItemId, "key")).toMatchObject({ id: "session", startedAt: expect.any(Number) });
    await endFocusRemote("session", "stopped", "stan", "akcja");
    await recordLearningEvidenceRemote(workspaceId, "session", { learningGoalId: "goal", title: "Próba", result: "supports", feedback: "OK" });
    await updateScratchpadRemote("session", "scratchpad");
    await resolveInboxRemote("captured");
    await decideAIProposalRemote("proposal", "approved");
    await decideAIProposalRemote("proposal", "rejected");
    await completeReviewRemote(workspaceId, "Decyzja");
    await setEntityVisibilityRemote(projectId, "archived");
    await setInboxStatusRemote("captured", "snoozed", "2026-08-02T08:00:00Z");
    await setCommitmentStatusRemote(projectId, "released");
    await setLearningGoalStatusRemote("goal", "abandoned", "Zmiana kierunku");
    expect(await createProjectRemote(workspaceId, { title: "P", outcome: "O", technology: "T", firstWorkItemTitle: "W", firstWorkItemDescription: "D" }, "key")).toBe(projectId);
    expect(await createLearningGoalRemote(workspaceId, { title: "G", criterion: "C", skill: "S" }, "key")).toBe("goal");

    expect(client.calls.filter((call) => call.kind === "rpc").map((call) => call.name)).toEqual(expect.arrayContaining([
      "capture_item", "start_focus_session", "end_focus_session", "record_learning_evidence", "resolve_inbox_item",
      "approve_ai_proposal", "reject_ai_proposal", "complete_weekly_review", "create_shaped_project", "create_learning_goal",
      "set_entity_visibility", "set_inbox_item_status", "set_commitment_status", "set_learning_goal_status"
    ]));
  });

  it("eksportuje wszystkie tabele Workspace w wersjonowanej kopercie", async () => {
    const client = fakeClient({ workspaces: { id: workspaceId, name: "Osobiste" }, entities: [{ id: projectId }] });
    getClient.mockReturnValue(client);
    const exported = await exportWorkspaceRemote(workspaceId);
    expect(exported).toMatchObject({ format: "developer-command-center/export", version: 1, workspace: { id: workspaceId } });
    expect(exported.tables).toHaveProperty("entities");
    expect(exported.tables).toHaveProperty("activity_events");
  });
});
