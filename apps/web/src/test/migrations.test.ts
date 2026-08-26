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
  new URL("../../../../supabase/migrations/20260804090000_add_reversible_state_commands.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260804124522_goal_centric_model.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260805193000_ui_ux_remediation_commands.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260807120000_projects_as_persistent_contexts.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260809130312_harden_public_release_boundaries.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260820182555_link_knowledge_as_decision_evidence.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260820182703_index_knowledge_evidence_fk.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260823070000_explicit_knowledge_relations.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260824054519_workspace_core_and_pages.sql", import.meta.url),
  new URL("../../../../supabase/migrations/20260825071833_add_ai_goal_reviews.sql", import.meta.url)
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
    expect(tableCount).toBe(31);
    expect(rlsCount).toBe(31);
  });

  it("nie wystawia tabel bez polityk ani uprzywilejowanych funkcji publicznych", async () => {
    expect(await scalar<number>("select count(*)::int from pg_tables table_row where schemaname = 'public' and not exists (select 1 from pg_policies policy where policy.schemaname = 'public' and policy.tablename = table_row.tablename)")).toBe(0);
    expect(await scalar<number>("select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'")).toBe(0);
    expect(await scalar<number>("select count(*)::int from pg_proc function_row join pg_namespace namespace on namespace.oid = function_row.pronamespace where namespace.nspname = 'public' and function_row.prosecdef")).toBe(0);
    expect(await scalar<number>("select count(*)::int from information_schema.routine_privileges where routine_schema = 'public' and grantee in ('PUBLIC', 'anon') and privilege_type = 'EXECUTE'")).toBe(0);
    expect((await database.query("select routine_name, grantee from information_schema.routine_privileges where routine_schema = 'private' and grantee in ('PUBLIC', 'anon') and privilege_type = 'EXECUTE' order by routine_name, grantee")).rows).toEqual([]);
    expect(await scalar<number>("select count(*)::int from pg_proc function_row join pg_namespace namespace on namespace.oid = function_row.pronamespace where namespace.nspname = 'public' and function_row.prosrc ilike '%insert into public.activity_events%'")).toBe(0);
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
    await database.query("select public.set_entity_visibility($1, 'archived', $2)", [projectId, "70000000-0000-0000-0000-000000000002"]);
    await database.query("select public.set_entity_visibility($1, 'active', $2)", [projectId, "70000000-0000-0000-0000-000000000003"]);
    await database.query("select public.set_inbox_item_status($1, 'discarded', null, $2)", [inboxId, "70000000-0000-0000-0000-000000000004"]);
    await database.query("select public.set_inbox_item_status($1, 'unprocessed', null, $2)", [inboxId, "70000000-0000-0000-0000-000000000004"]);
    expect(await scalar<string>("select status::text from public.inbox_items where id = $1", [inboxId])).toBe("discarded");
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

  it("tworzy Cel z Działaniem idempotentnie i nie duplikuje wystąpienia serii", async () => {
    const user = "80000000-0000-0000-0000-000000000008";
    const goalId = "80000000-0000-0000-0000-000000000010";
    const actionId = "80000000-0000-0000-0000-000000000011";
    const seriesId = "80000000-0000-0000-0000-000000000012";
    const occurrenceId = "80000000-0000-0000-0000-000000000013";
    const commandId = "80000000-0000-0000-0000-000000000099";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)", [user, '{"workspace_name":"Workspace H"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    await database.query("select public.create_goal_with_action($1, $2, $3, 'Budżet', 'Aktualny plan wydatków', 'personal', null, 'Spisz koszty', '', $4)", [workspace, goalId, actionId, commandId]);
    await database.query("select public.create_goal_with_action($1, $2, $3, 'Budżet', 'Aktualny plan wydatków', 'personal', null, 'Spisz koszty', '', $4)", [workspace, goalId, actionId, commandId]);
    expect(await scalar<number>("select count(*)::int from public.goals where id = $1", [goalId])).toBe(1);
    expect(await scalar<number>("select count(*)::int from public.actions where goal_id = $1", [goalId])).toBe(1);

    await database.query("insert into public.recurring_action_templates (id, workspace_id, title, starts_on, recurrence_rule) values ($1, $2, 'Przegląd', '2026-08-04', '{\"unit\":\"week\",\"interval\":1}'::jsonb)", [seriesId, workspace]);
    await database.query("select public.materialize_recurring_occurrence($1, $2, $3, '2026-08-04', $4)", [workspace, seriesId, occurrenceId, "80000000-0000-0000-0000-000000000097"]);
    await database.query("select public.materialize_recurring_occurrence($1, $2, $3, '2026-08-04', $4)", [workspace, seriesId, "80000000-0000-0000-0000-000000000014", "80000000-0000-0000-0000-000000000096"]);
    expect(await scalar<number>("select count(*)::int from public.actions where recurring_template_id = $1 and occurrence_date = '2026-08-04'", [seriesId])).toBe(1);
    await database.exec("reset role");
  });

  it("egzekwuje atomowe komendy UI/UX, wersje, RLS i prawdziwe typy capture", async () => {
    const user = "90000000-0000-0000-0000-000000000009";
    const otherUser = "91000000-0000-0000-0000-000000000009";
    const goalId = "90000000-0000-0000-0000-000000000010";
    const actionId = "90000000-0000-0000-0000-000000000011";
    const knowledgeId = "90000000-0000-0000-0000-000000000012";
    const decisionId = "90000000-0000-0000-0000-000000000016";
    const seriesId = "90000000-0000-0000-0000-000000000014";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $3::jsonb), ($2, $4::jsonb)", [user, otherUser, '{"workspace_name":"Workspace I"}', '{"workspace_name":"Workspace J"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await database.query("insert into public.goals (id, workspace_id, title, outcome) values ($1, $2, 'Cel', 'Rezultat')", [goalId, workspace]);
    await database.query("insert into public.actions (id, workspace_id, goal_id, title) values ($1, $2, $3, 'Krok')", [actionId, workspace, goalId]);

    const createdActionId = "90000000-0000-0000-0000-000000000013";
    const createActionCommand = "90000000-0000-0000-0000-000000000029";
    await database.query("select public.create_action_item($1, $2, $3, null, 'Drugi krok', '', null, false, $4)", [workspace, createdActionId, goalId, createActionCommand]);
    await database.query("select public.create_action_item($1, $2, $3, null, 'Zmieniona próba', '', null, false, $4)", [workspace, createdActionId, goalId, createActionCommand]);
    expect(await scalar<string>("select title from public.actions where id = $1", [createdActionId])).toBe("Drugi krok");
    const nextActionCommand = "90000000-0000-0000-0000-000000000030";
    await database.query("select public.set_next_action_checked($1, $2, $3)", [goalId, createdActionId, nextActionCommand]);
    await database.query("select public.set_next_action_checked($1, $2, $3)", [goalId, actionId, nextActionCommand]);
    expect(await scalar<string>("select id::text from public.actions where goal_id = $1 and is_next", [goalId])).toBe(createdActionId);
    const visibilityCommand = "90000000-0000-0000-0000-000000000031";
    await database.query("select public.set_goal_visibility_checked($1, 'archived', $2)", [goalId, visibilityCommand]);
    await database.query("select public.set_goal_visibility_checked($1, 'trashed', $2)", [goalId, visibilityCommand]);
    expect(await scalar<boolean>("select archived_at is not null and trashed_at is null from public.goals where id = $1", [goalId])).toBe(true);

    const seriesCommand = "90000000-0000-0000-0000-000000000032";
    const seriesData = JSON.stringify({ title: "Przegląd", detail: "Pierwsza wersja", goalId, timezone: "Europe/Warsaw", startsOn: "2026-08-06", rule: { unit: "week", interval: 1 }, missedPolicy: "skip_missed", checklist: [{ title: "Sprawdź" }] });
    await database.query("select public.create_recurring_action_template($1, $2, $3::jsonb, $4)", [workspace, seriesId, seriesData, seriesCommand]);
    await database.query("select public.create_recurring_action_template($1, $2, '{\"title\":\"Nie nadpisuj\",\"startsOn\":\"2026-08-07\",\"rule\":{\"unit\":\"day\",\"interval\":1}}'::jsonb, $3)", [workspace, seriesId, seriesCommand]);
    expect(await scalar<string>("select title from public.recurring_action_templates where id = $1", [seriesId])).toBe("Przegląd");
    const futureActionId = "90000000-0000-0000-0000-000000000015";
    await database.query("insert into public.actions (id, workspace_id, goal_id, recurring_template_id, occurrence_date, title) values ($1, $2, $3, $4, '2026-08-13', 'Stary tytuł')", [futureActionId, workspace, goalId, seriesId]);
    const updateSeriesCommand = "90000000-0000-0000-0000-000000000033";
    await database.query("select public.update_recurring_action_template($1, '{\"title\":\"Przegląd tygodnia\"}'::jsonb, true, '2026-08-06', $2)", [seriesId, updateSeriesCommand]);
    await database.query("select public.update_recurring_action_template($1, '{\"title\":\"Nie nadpisuj\"}'::jsonb, true, '2026-08-06', $2)", [seriesId, updateSeriesCommand]);
    expect(await scalar<string>("select title from public.actions where id = $1", [futureActionId])).toBe("Przegląd tygodnia");
    const seriesStatusCommand = "90000000-0000-0000-0000-000000000034";
    await database.query("select public.set_recurring_action_template_status($1, 'paused', $2)", [seriesId, seriesStatusCommand]);
    await database.query("select public.set_recurring_action_template_status($1, 'archived', $2)", [seriesId, seriesStatusCommand]);
    expect(await scalar<string>("select status from public.recurring_action_templates where id = $1", [seriesId])).toBe("paused");

    const actionCommand = "90000000-0000-0000-0000-000000000020";
    const checklist = JSON.stringify({ checklist: [{ id: "check-1", title: "Dowód", completed: true }] });
    await database.query("select public.update_action_checked($1, 1, $2::jsonb, $3)", [actionId, checklist, actionCommand]);
    await database.query("select public.update_action_checked($1, 1, $2::jsonb, $3)", [actionId, checklist, actionCommand]);
    expect(await scalar<number>("select version from public.actions where id = $1", [actionId])).toBe(2);
    await expect(database.query("select public.update_action_checked($1, 1, '{}'::jsonb, $2)", [actionId, "90000000-0000-0000-0000-000000000021"])).rejects.toThrow("action_version_conflict");
    const statusCommand = "90000000-0000-0000-0000-000000000028";
    await database.query("select public.set_action_status_checked($1, 'blocked', 'Czekam na dane', $2)", [actionId, statusCommand]);
    await database.query("select public.set_action_status_checked($1, 'completed', null, $2)", [actionId, statusCommand]);
    expect(await scalar<string>("select status from public.actions where id = $1", [actionId])).toBe("blocked");
    expect(await scalar<number>("select count(*)::int from public.progress_entries where action_id = $1", [actionId])).toBe(1);

    await database.query("select public.set_goal_outcome_status($1, 'achieved', null, $2, 'Cel osiągnięty.', $3)", [goalId, "90000000-0000-0000-0000-000000000022", "90000000-0000-0000-0000-000000000023"]);
    expect(await scalar<number>("select count(*)::int from public.progress_entries where goal_id = $1 and kind = 'decision'", [goalId])).toBe(1);

    const links = JSON.stringify([{ id: "90000000-0000-0000-0000-000000000024", goalId }]);
    const knowledgeCommand = "90000000-0000-0000-0000-000000000025";
    await expect(database.query("select public.create_knowledge_with_goal_links($1, $2, 'resource', 'Niebezpieczne źródło', 'Treść', 'javascript:alert(1)', $3::jsonb, 'reference', $4)", [workspace, knowledgeId, links, knowledgeCommand])).rejects.toThrow("invalid_knowledge_source_url");
    await database.query("select public.create_knowledge_with_goal_links($1, $2, 'note', 'Notatka', 'Treść', null, $3::jsonb, 'reference', $4)", [workspace, knowledgeId, links, knowledgeCommand]);
    await database.query("select public.create_knowledge_with_goal_links($1, $2, 'note', 'Inna nazwa', 'Treść', null, $3::jsonb, 'reference', $4)", [workspace, knowledgeId, links, knowledgeCommand]);
    expect(await scalar<number>("select count(*)::int from public.knowledge_links where knowledge_entity_id = $1", [knowledgeId])).toBe(1);
    const replacementLinks = JSON.stringify([]);
    const updateKnowledgeCommand = "90000000-0000-0000-0000-000000000027";
    await database.query("select public.update_knowledge_item($1, '{\"title\":\"Nowa notatka\"}'::jsonb, $2::jsonb, $3)", [knowledgeId, replacementLinks, updateKnowledgeCommand]);
    await database.query("select public.update_knowledge_item($1, '{\"title\":\"Powtórzona próba\"}'::jsonb, $2::jsonb, $3)", [knowledgeId, replacementLinks, updateKnowledgeCommand]);
    expect(await scalar<string>("select title from public.entities where id = $1", [knowledgeId])).toBe("Nowa notatka");
    expect(await scalar<number>("select count(*)::int from public.knowledge_links where knowledge_entity_id = $1 and goal_id is not null", [knowledgeId])).toBe(0);

    await database.query("select public.create_knowledge_with_goal_links($1, $2, 'decision', 'Wybieramy PostgreSQL', 'Uzasadnienie', null, '[]'::jsonb, 'decision', $3)", [workspace, decisionId, "90000000-0000-0000-0000-000000000036"]);
    await database.query("insert into public.knowledge_links (workspace_id, knowledge_entity_id, target_knowledge_entity_id, meaning) values ($1, $2, $3, 'material')", [workspace, knowledgeId, decisionId]);
    expect(await scalar<number>("select count(*)::int from public.knowledge_links where knowledge_entity_id = $1 and target_knowledge_entity_id = $2", [knowledgeId, decisionId])).toBe(1);
    await expect(database.query("insert into public.knowledge_links (workspace_id, knowledge_entity_id, target_knowledge_entity_id, meaning) values ($1, $2, $2, 'material')", [workspace, decisionId])).rejects.toThrow("knowledge_links_no_self_reference_check");

    await expect(database.query("insert into public.inbox_items (workspace_id, kind, raw_content) values ($1, 'voice', 'fałszywe nagranie')", [workspace])).rejects.toThrow("capture_asset_required");
    await expect(database.query("insert into public.inbox_items (workspace_id, kind, raw_content) values ($1, 'link', 'javascript:alert(1)')", [workspace])).rejects.toThrow("invalid_capture_url");

    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [otherUser]);
    await expect(database.query("select public.update_action_checked($1, 2, '{}'::jsonb, $2)", [actionId, "90000000-0000-0000-0000-000000000026"])).rejects.toThrow(/action_not_found|workspace_access_denied/);
    await database.exec("reset role");
  });

  it("zamyka bezpośredni zapis audytu i kolejki AI oraz waliduje trwałe URL-e", async () => {
    const user = "a1000000-0000-0000-0000-000000000001";
    const otherUser = "a2000000-0000-0000-0000-000000000002";
    const proposalId = "a1000000-0000-0000-0000-000000000010";
    const knowledgeId = "a1000000-0000-0000-0000-000000000011";
    const commandId = "a1000000-0000-0000-0000-000000000012";
    const approvalId = "a1000000-0000-0000-0000-000000000013";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $3::jsonb), ($2, $4::jsonb)", [user, otherUser, '{"workspace_name":"Workspace Security"}', '{"workspace_name":"Other Security"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    const otherWorkspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [otherUser]);

    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    await database.query("insert into public.ai_proposals (id, workspace_id, command_name, command_args, preview_diff, risk, expires_at) values ($1, $2, 'create_work_item', '{}', '{}', 'low', now() + interval '1 hour')", [proposalId, workspace]);
    await expect(database.query("update public.ai_proposals set status = 'approved' where id = $1", [proposalId])).rejects.toThrow();
    await expect(database.query("insert into public.ai_proposals (workspace_id, command_name, command_args, preview_diff, risk, status, expires_at) values ($1, 'create_work_item', '{}', '{}', 'low', 'approved', now() + interval '1 hour')", [workspace])).rejects.toThrow();
    await expect(database.query("insert into public.ai_executions (workspace_id, proposal_id, requested_by, idempotency_key) values ($1, $2, $3, $4)", [workspace, proposalId, user, commandId])).rejects.toThrow();
    await expect(database.query("insert into public.activity_events (workspace_id, actor_user_id, source, command_name, correlation_id) values ($1, $2, 'system', 'forged', $3)", [workspace, user, commandId])).rejects.toThrow();

    const executionId = await scalar<string>("select (public.approve_ai_proposal($1, $2)).id::text", [proposalId, approvalId]);
    expect(await scalar<string>("select status::text from public.ai_executions where id = $1", [executionId])).toBe("queued");
    expect(await scalar<string>("select status::text from public.ai_proposals where id = $1", [proposalId])).toBe("approved");

    await database.query("select public.create_knowledge_with_goal_links($1, $2, 'resource', 'Bezpieczne źródło', '', 'https://example.com', '[]'::jsonb, 'reference', $3)", [workspace, knowledgeId, commandId]);
    await expect(database.query("update public.knowledge_items set source_url = 'javascript:alert(1)' where entity_id = $1", [knowledgeId])).rejects.toThrow("knowledge_items_source_url_http_check");
    expect((await database.query("update public.knowledge_items set source_url = 'https://example.com/updated' where entity_id = $1 returning entity_id", [knowledgeId])).rows).toHaveLength(1);
    await database.exec("reset role");

    await expect(database.query("insert into public.ai_executions (workspace_id, proposal_id, requested_by, idempotency_key) values ($1, $2, $3, $4)", [otherWorkspace, proposalId, otherUser, "a2000000-0000-0000-0000-000000000099"])).rejects.toThrow("ai_executions_proposal_workspace_fkey");
  });

  it("atomowo tworzy relacje Wiedzy i rezultat Działania z idempotencją oraz RLS", async () => {
    const user = "b1000000-0000-0000-0000-000000000001";
    const otherUser = "b2000000-0000-0000-0000-000000000002";
    const goalId = "b1000000-0000-0000-0000-000000000010";
    const actionId = "b1000000-0000-0000-0000-000000000011";
    const artifactId = "b1000000-0000-0000-0000-000000000012";
    const relationId = "b1000000-0000-0000-0000-000000000013";
    const createCommandId = "b1000000-0000-0000-0000-000000000014";
    const invalidId = "b1000000-0000-0000-0000-000000000015";
    const invalidCommandId = "b1000000-0000-0000-0000-000000000016";
    const resultActionId = "b1000000-0000-0000-0000-000000000017";
    const resultId = "b1000000-0000-0000-0000-000000000018";
    const resultLinkId = "b1000000-0000-0000-0000-000000000019";
    const progressId = "b1000000-0000-0000-0000-000000000020";
    const resultCommandId = "b1000000-0000-0000-0000-000000000021";
    const existingActionId = "b1000000-0000-0000-0000-000000000022";
    const existingLinkId = "b1000000-0000-0000-0000-000000000023";
    const existingCommandId = "b1000000-0000-0000-0000-000000000024";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $3::jsonb), ($2, $4::jsonb)", [user, otherUser, '{"workspace_name":"Workspace Knowledge"}', '{"workspace_name":"Other Knowledge"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await database.query("insert into public.goals (id, workspace_id, title, outcome) values ($1, $2, 'Cel Wiedzy', 'Rezultat')", [goalId, workspace]);
    await database.query("insert into public.actions (id, workspace_id, goal_id, title) values ($1, $2, $3, 'Akcja źródłowa'), ($4, $2, $3, 'Akcja z nowym rezultatem'), ($5, $2, $3, 'Akcja z istniejącym rezultatem')", [actionId, workspace, goalId, resultActionId, existingActionId]);

    const actionRelation = JSON.stringify([{ id: relationId, meaning: "result", target: { actionId } }]);
    expect(await scalar<string>("select public.create_knowledge_with_relations($1, $2, 'artifact', 'Kanoniczny rezultat', 'Treść', null, null, null, $3::jsonb, $4)::text", [workspace, artifactId, actionRelation, createCommandId])).toBe(artifactId);
    expect(await scalar<string>("select public.create_knowledge_with_relations($1, $2, 'artifact', 'Inny tytuł', 'Inna treść', null, null, null, $3::jsonb, $4)::text", [workspace, artifactId, actionRelation, createCommandId])).toBe(artifactId);
    expect(await scalar<string>("select title from public.entities where id = $1", [artifactId])).toBe("Kanoniczny rezultat");
    expect(await scalar<number>("select count(*)::int from public.knowledge_links where knowledge_entity_id = $1 and meaning = 'result'", [artifactId])).toBe(1);

    await expect(database.query("select public.create_knowledge_with_relations($1, $2, 'note', 'Niedozwolona notatka', '', null, null, null, $3::jsonb, $4)", [workspace, invalidId, actionRelation, invalidCommandId])).rejects.toThrow("knowledge_result_requires_artifact");
    expect(await scalar<number>("select count(*)::int from public.entities where id = $1", [invalidId])).toBe(0);

    const newResultInput = JSON.stringify({ kind: "new", title: "Rezultat z RPC", detail: "Zapisany atomowo" });
    expect(await scalar<string>("select public.record_action_result($1, $2, $3::jsonb, $4, $5, $6, $7)::text", [workspace, resultActionId, newResultInput, resultId, resultLinkId, progressId, resultCommandId])).toBe(resultId);
    expect(await scalar<string>("select public.record_action_result($1, $2, '{\"kind\":\"new\",\"title\":\"Nie nadpisuj\",\"detail\":\"\"}'::jsonb, $3, $4, $5, $6)::text", [workspace, resultActionId, resultId, resultLinkId, progressId, resultCommandId])).toBe(resultId);
    expect(await scalar<number>("select count(*)::int from public.knowledge_links where action_id = $1 and meaning = 'result'", [resultActionId])).toBe(1);
    expect(await scalar<number>("select count(*)::int from public.progress_entries where action_id = $1 and knowledge_entity_id = $2 and kind = 'result'", [resultActionId, resultId])).toBe(1);

    const existingInput = JSON.stringify({ kind: "existing" });
    expect(await scalar<string>("select public.record_action_result($1, $2, $3::jsonb, $4, $5, null, $6)::text", [workspace, existingActionId, existingInput, artifactId, existingLinkId, existingCommandId])).toBe(artifactId);
    expect(await scalar<number>("select count(*)::int from public.knowledge_links where action_id = $1 and meaning = 'result'", [existingActionId])).toBe(1);

    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [otherUser]);
    await expect(database.query("select public.record_action_result($1, $2, '{\"kind\":\"new\",\"title\":\"Obcy\"}'::jsonb, $3, $4, null, $5)", [workspace, resultActionId, "b2000000-0000-0000-0000-000000000010", "b2000000-0000-0000-0000-000000000011", "b2000000-0000-0000-0000-000000000012"])).rejects.toThrow("workspace_access_denied");
    await database.exec("reset role");
  });

  it("buduje ograniczony kontekst AI i izoluje wyniki oraz feedback między Workspace", async () => {
    const user = "c1000000-0000-0000-0000-000000000001";
    const otherUser = "c2000000-0000-0000-0000-000000000002";
    const goalId = "c1000000-0000-0000-0000-000000000010";
    const runId = "c1000000-0000-0000-0000-000000000011";
    const reviewId = "c1000000-0000-0000-0000-000000000012";
    await database.query("insert into auth.users (id, raw_user_meta_data) values ($1, $3::jsonb), ($2, $4::jsonb)", [user, otherUser, '{"workspace_name":"Workspace AI"}', '{"workspace_name":"Other AI"}']);
    const workspace = await scalar<string>("select workspace_id::text from public.workspace_members where user_id = $1", [user]);
    await database.query("insert into public.goals (id, workspace_id, title, outcome, updated_at) values ($1, $2, 'Cel AI', 'Jawny rezultat', now() - interval '15 days')", [goalId, workspace]);

    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    const context = await scalar<{ goals: Array<{ id: string; signals: Array<{ signalKey: string }> }> }>("select public.get_ai_goal_review_context($1, 28)", [workspace]);
    expect(context.goals).toHaveLength(1);
    expect(context.goals[0]?.signals.map((signal) => signal.signalKey)).toContain(`goal:${goalId}:missing-next-action`);
    expect(context.goals[0]?.signals.map((signal) => signal.signalKey)).toContain(`goal:${goalId}:missing-criteria`);
    await expect(database.query("insert into public.ai_runs (workspace_id,user_id,capability,provider,model,prompt_version,schema_version,status) values ($1,$2,'goal_portfolio_review','nvidia','model',1,1,'running')", [workspace, user])).rejects.toThrow();
    await database.exec("reset role");

    await database.query("insert into public.ai_runs (id,workspace_id,user_id,capability,provider,model,prompt_version,schema_version,status) values ($1,$2,$3,'goal_portfolio_review','nvidia','model',1,1,'succeeded')", [runId, workspace, user]);
    const reviewJson = JSON.stringify({ schemaVersion: 1, headline: "Kierunek", summary: "Podsumowanie", overallStatus: "attention", recommendations: [{ id: "rec-1", title: "Krok", reason: "Powód", suggestedNextStep: "Ruch", horizon: "now", confidence: "high", goalIds: [goalId], actionIds: [], signalKeys: [`goal:${goalId}:missing-next-action`] }], checks: [], goalAssessments: [] });
    await database.query("insert into public.ai_goal_reviews (id,workspace_id,created_by,run_id,period_start,period_end,source_snapshot_at,context_hash,prompt_version,schema_version,provider,model,review_json,analyzed_goal_ids,cache_expires_at) values ($1,$2,$3,$4,current_date-28,current_date,now(),repeat('a',64),1,1,'nvidia','model',$5::jsonb,array[$6::uuid],now()+interval '1 day')", [reviewId, workspace, user, runId, reviewJson, goalId]);

    await database.exec("set role authenticated");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    expect(await scalar<number>("select count(*)::int from public.ai_goal_reviews")).toBe(1);
    await database.query("select public.set_ai_goal_review_feedback($1,$2,'rec-1','helpful')", [workspace, reviewId]);
    await database.query("select public.set_ai_goal_review_feedback($1,$2,'rec-1','not_helpful')", [workspace, reviewId]);
    expect(await scalar<string>("select rating from public.ai_goal_review_feedback where review_id = $1", [reviewId])).toBe("not_helpful");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [otherUser]);
    expect(await scalar<number>("select count(*)::int from public.ai_goal_reviews")).toBe(0);
    expect(await scalar<unknown>("select public.get_ai_goal_review_context($1, 28)", [workspace])).toBeNull();
    await expect(database.query("select public.set_ai_goal_review_feedback($1,$2,'rec-1','helpful')", [workspace, reviewId])).rejects.toThrow("workspace_not_available");
    await database.exec("reset role");
  });
});
