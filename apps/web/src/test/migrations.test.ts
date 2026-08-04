// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const bootstrapUrl = new URL("../../../../supabase/tests/bootstrap.sql", import.meta.url);
const migrationUrls = [
  new URL("../../../../supabase/migrations/20260801071252_initial_command_center.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260801074308_add_ai_approval_command.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260801074644_add_project_creation_command.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260801075900_harden_focus_commands.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260801080732_add_audited_commands.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260804090000_add_reversible_state_commands.sql", import.meta.url)
];

const database = new PGlite();

async function scalar<T>(sql: string, params: unknown[] = []) {
  const result = await database.query<Record<string, T>>(sql, params);
  return Object.values(result.rows[0] ?? {})[0] as T;
}

describe("migracje Supabase", () => {
  beforeAll(async () => {
    await database.exec(await readFile(bootstrapUrl, "utf8"));
    for (const url of migrationUrls) {
      const sql = (await readFile(url, "utf8")).replace("create extension if not exists pgcrypto with schema extensions;", "");
      await database.exec(sql);
    }
  }, 30_000);

  it("tworzy komplet tabel publicznych z włączonym RLS", async () => {
    const tableCount = await scalar<number>("select count(*)::int from pg_tables where schemaname = 'public'");
    const rlsCount = await scalar<number>("select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity");
    expect(tableCount).toBe(19);
    expect(rlsCount).toBe(19);
  });

  it("nie wystawia tabel bez polityk ani uprzywilejowanych funkcji publicznych", async () => {
    expect(await scalar<number>("select count(*)::int from pg_tables table_row where schemaname = 'public' and not exists (select 1 from pg_policies policy where policy.schemaname = 'public' and policy.tablename = table_row.tablename)")).toBe(0);
    expect(await scalar<number>("select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'")).toBe(0);
    expect(await scalar<number>("select count(*)::int from pg_proc function_row join pg_namespace namespace on namespace.oid = function_row.pronamespace where namespace.nspname = 'public' and function_row.prosecdef")).toBe(0);
    expect(await scalar<number>("select count(*)::int from information_schema.routine_privileges where routine_schema = 'public' and grantee in ('PUBLIC', 'anon') and privilege_type = 'EXECUTE'")).toBe(0);
  });

  it("izoluje dwa Workspace dla SELECT, INSERT, UPDATE i DELETE", async () => {
    const userA = "10000000-0000-0000-0000-000000000001";
    const userB = "20000000-0000-0000-0000-000000000002";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $3::jsonb), ($2, $4::jsonb)", [userA, userB, '{"workspace_name":"Workspace A"}', '{"workspace_name":"Workspace B"}']);
    const workspaceA = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [userA]);

    await database.query("insert into public.entities (id, workspace_id, type, title) values ($1, $2, 'project', 'Sekretny projekt A')", ["a0000000-0000-0000-0000-000000000001", workspaceA]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userB]);

    expect(await scalar<number>("select count(*)::int from public.entities")).toBe(0);
    await expect(database.query("insert into public.entities (workspace_id, type, title) values ($1, 'note', 'Nieautoryzowany insert')", [workspaceA])).rejects.toThrow();
    expect((await database.query("update public.entities set title = 'Przejęty' where id = 'a0000000-0000-0000-0000-000000000001' returning id")).rows).toHaveLength(0);
    expect((await database.query("delete from public.entities where id = 'a0000000-0000-0000-0000-000000000001' returning id")).rows).toHaveLength(0);

    await database.exec("reset role");
    expect(await scalar<string>("select title from public.entities where id = 'a0000000-0000-0000-0000-000000000001'")).toBe("Sekretny projekt A");

    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
    expect(await scalar<number>("select count(*)::int from public.entities")).toBe(1);
    expect((await database.query("update public.entities set title = 'Projekt A po aktualizacji' where id = 'a0000000-0000-0000-0000-000000000001' returning id")).rows).toHaveLength(1);
    expect((await database.query("delete from public.entities where id = 'a0000000-0000-0000-0000-000000000001' returning id")).rows).toHaveLength(1);
    await database.exec("reset role");
  });

  it("tworzy projekt, pierwszy Work Item i Primary Commitment atomowo", async () => {
    const user = "30000000-0000-0000-0000-000000000003";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)", [user, '{"workspace_name":"Workspace C"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    const projectId = await scalar<string>("select public.create_shaped_project($1, 'Command', 'Działająca aplikacja', 'React, Supabase', 'Zbuduj dashboard', 'Odtwórz makietę', 240, $2)::text", [workspace, "30000000-0000-0000-0000-000000000099"]);
    const retriedProjectId = await scalar<string>("select public.create_shaped_project($1, 'Command', 'Działająca aplikacja', 'React, Supabase', 'Zbuduj dashboard', 'Odtwórz makietę', 240, $2)::text", [workspace, "30000000-0000-0000-0000-000000000099"]);
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
    expect(retriedProjectId).toBe(projectId);
    expect(await scalar<number>("select count(*)::int from public.work_items where primary_context_entity_id = $1", [projectId])).toBe(1);
    expect(await scalar<boolean>("select is_primary from public.commitments where target_entity_id = $1", [projectId])).toBe(true);
    expect(await scalar<number>("select count(*)::int from public.activity_events where correlation_id = $1", ["30000000-0000-0000-0000-000000000099"])).toBe(1);
    await database.exec("reset role");
  });

  it("bezpiecznie ponawia Capture oraz start i koniec Focus Session", async () => {
    const user = "40000000-0000-0000-0000-000000000004";
    const commandId = "40000000-0000-0000-0000-000000000099";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)", [user, '{"workspace_name":"Workspace D"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    await database.query("select public.capture_item($1, 'Pomysł', 'text', $2)", [workspace, commandId]);
    await database.query("select public.capture_item($1, 'Inna treść nie nadpisuje pierwszej', 'text', $2)", [workspace, commandId]);
    expect(await scalar<number>("select count(*)::int from public.inbox_items where idempotency_key = $1", [commandId])).toBe(1);
    expect(await scalar<string>("select raw_content from public.inbox_items where idempotency_key = $1", [commandId])).toBe("Pomysł");

    const projectId = await scalar<string>("select public.create_shaped_project($1, 'Focus', 'Sprawdzony przepływ', 'React', 'Pierwszy krok', '', null, $2)::text", [workspace, "40000000-0000-0000-0000-000000000098"]);
    const workItemId = await scalar<string>("select entity_id::text from public.work_items where primary_context_entity_id = $1", [projectId]);
    const sessionId = await scalar<string>("select (public.start_focus_session($1, $2, $3)).id::text", [workspace, workItemId, "40000000-0000-0000-0000-000000000097"]);
    const retriedSessionId = await scalar<string>("select (public.start_focus_session($1, $2, $3)).id::text", [workspace, workItemId, "40000000-0000-0000-0000-000000000097"]);
    expect(retriedSessionId).toBe(sessionId);

    await database.query("select public.end_focus_session($1, 'paused', 'Stan zapisany', 'Następna akcja')", [sessionId]);
    await database.query("select public.end_focus_session($1, 'paused', 'Stan zapisany', 'Następna akcja')", [sessionId]);
    expect(await scalar<number>("select count(*)::int from public.context_checkpoints where focus_session_id = $1", [sessionId])).toBe(1);
    expect(await scalar<number>("select count(*)::int from public.activity_events where workspace_id = $1", [workspace])).toBe(4);
    await database.exec("reset role");
  });

  it("oddziela approval AI od wykonania i idempotentnie zapisuje Review", async () => {
    const user = "50000000-0000-0000-0000-000000000005";
    const proposalId = "50000000-0000-0000-0000-000000000050";
    const approvalId = "50000000-0000-0000-0000-000000000051";
    const reviewId = "50000000-0000-0000-0000-000000000052";
    const goalId = "50000000-0000-0000-0000-000000000053";
    const evidenceCommandId = "50000000-0000-0000-0000-000000000054";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)", [user, '{"workspace_name":"Workspace E"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await database.query("insert into public.ai_proposals (id, workspace_id, command_name, command_args, preview_diff, risk, expires_at) values ($1, $2, 'create_work_item', '{}', '{}', 'low', now() + interval '1 hour')", [proposalId, workspace]);

    const executionId = await scalar<string>("select (public.approve_ai_proposal($1, $2)).id::text", [proposalId, approvalId]);
    const retriedExecutionId = await scalar<string>("select (public.approve_ai_proposal($1, $2)).id::text", [proposalId, approvalId]);
    expect(retriedExecutionId).toBe(executionId);
    expect(await scalar<string>("select status::text from public.ai_executions where id = $1", [executionId])).toBe("queued");
    expect(await scalar<string>("select status::text from public.ai_proposals where id = $1", [proposalId])).toBe("approved");

    await database.query("select public.complete_weekly_review($1, 'Ograniczam WIP', $2)", [workspace, reviewId]);
    await database.query("select public.complete_weekly_review($1, 'Ograniczam WIP', $2)", [workspace, reviewId]);
    expect(await scalar<number>("select count(*)::int from public.reviews where workspace_id = $1", [workspace])).toBe(1);
    await database.query("insert into public.entities (id, workspace_id, type, title) values ($1, $2, 'learning_goal', 'Modelowanie')", [goalId, workspace]);
    await database.query("insert into public.learning_goals (entity_id, workspace_id, demonstration_criterion, status) values ($1, $2, 'Obroń model', 'shaped')", [goalId, workspace]);
    const evidenceId = await scalar<string>("select public.record_learning_evidence($1, $2, null, 'Próba modelu', 'supports', 'Poprawnie', $3)::text", [workspace, goalId, evidenceCommandId]);
    const retriedEvidenceId = await scalar<string>("select public.record_learning_evidence($1, $2, null, 'Próba modelu', 'supports', 'Poprawnie', $3)::text", [workspace, goalId, evidenceCommandId]);
    expect(retriedEvidenceId).toBe(evidenceId);
    expect(await scalar<number>("select count(*)::int from public.learning_evidence where learning_goal_id = $1", [goalId])).toBe(1);
    expect(await scalar<number>("select count(*)::int from public.activity_events where workspace_id = $1", [workspace])).toBe(3);
    await database.exec("reset role");
  });

  it("egzekwuje limit WIP, jedną sesję Focus i wymagany checkpoint", async () => {
    const user = "60000000-0000-0000-0000-000000000006";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)", [user, '{"workspace_name":"Workspace F"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    const projectIds: string[] = [];
    for (let index = 0; index < 3; index++) projectIds.push(await scalar<string>("select public.create_shaped_project($1, $2, 'Outcome', 'React', $3, '', null, $4)::text", [workspace, `Project ${index}`, `Work ${index}`, `60000000-0000-0000-0000-00000000000${index}`]));
    await expect(database.query("select public.create_shaped_project($1, 'Project 4', 'Outcome', 'React', 'Work 4', '', null, $2)", [workspace, "60000000-0000-0000-0000-000000000009"])).rejects.toThrow("wip_limit_reached");

    const firstWork = await scalar<string>("select entity_id::text from public.work_items where primary_context_entity_id = $1", [projectIds[0]]);
    const secondWork = await scalar<string>("select entity_id::text from public.work_items where primary_context_entity_id = $1", [projectIds[1]]);
    const session = await scalar<string>("select (public.start_focus_session($1, $2, $3)).id::text", [workspace, firstWork, "60000000-0000-0000-0000-000000000020"]);
    await expect(database.query("select public.start_focus_session($1, $2, $3)", [workspace, secondWork, "60000000-0000-0000-0000-000000000021"])).rejects.toThrow();
    await expect(database.query("select public.end_focus_session($1, 'paused')", [session])).rejects.toThrow("checkpoint_required");
    await database.query("select public.end_focus_session($1, 'paused', 'Stan', 'Następna akcja')", [session]);
    expect(await scalar<number>("select count(*)::int from public.context_checkpoints where focus_session_id = $1", [session])).toBe(1);
    await database.exec("reset role");
  });

  it("wykonuje odwracalne zmiany jako audytowane komendy kompensujące", async () => {
    const user = "70000000-0000-0000-0000-000000000007";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)", [user, '{"workspace_name":"Workspace G"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    const projectId = await scalar<string>("select public.create_shaped_project($1, 'Reversible', 'Bezpieczne zmiany', 'React', 'Pierwszy krok', '', null, $2)::text", [workspace, "70000000-0000-0000-0000-000000000001"]);
    const inboxId = await scalar<string>("select (public.capture_item($1, 'Odrzuć mnie', 'text', $2)).id::text", [workspace, "70000000-0000-0000-0000-000000000020"]);
    const goalId = await scalar<string>("select public.create_learning_goal($1, 'Cel do porzucenia', 'Demonstracja', 'Bezpieczeństwo', $2)::text", [workspace, "70000000-0000-0000-0000-000000000030"]);

    await database.query("select public.set_entity_visibility($1, 'trashed', $2)", [projectId, "70000000-0000-0000-0000-000000000002"]);
    await database.query("select public.set_entity_visibility($1, 'active', $2)", [projectId, "70000000-0000-0000-0000-000000000003"]);
    await database.query("select public.set_inbox_item_status($1, 'discarded', null, $2)", [inboxId, "70000000-0000-0000-0000-000000000004"]);
    await database.query("select public.set_inbox_item_status($1, 'unprocessed', null, $2)", [inboxId, "70000000-0000-0000-0000-000000000005"]);
    await database.query("select public.set_commitment_status($1, 'released', $2)", [projectId, "70000000-0000-0000-0000-000000000006"]);
    await database.query("select public.set_learning_goal_status($1, 'abandoned', 'Zmiana kierunku', $2)", [goalId, "70000000-0000-0000-0000-000000000007"]);

    expect(await scalar<string | null>("select trashed_at::text from public.entities where id = $1", [projectId])).toBeNull();
    expect(await scalar<string>("select status::text from public.inbox_items where id = $1", [inboxId])).toBe("unprocessed");
    expect(await scalar<string>("select status::text from public.commitments where target_entity_id = $1", [projectId])).toBe("released");
    expect(await scalar<string>("select status from public.learning_goals where entity_id = $1", [goalId])).toBe("abandoned");
    expect(await scalar<number>("select count(*)::int from public.activity_events where workspace_id = $1 and command_name like 'set_%'", [workspace])).toBe(6);
    await database.exec("reset role");
  });
});
