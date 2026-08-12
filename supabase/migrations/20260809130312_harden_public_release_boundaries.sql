-- Keep navigation targets safe even when a member writes through the Data API.
update public.knowledge_items
set source_url = null
where source_url is not null
  and (source_url <> btrim(source_url) or source_url !~* '^https?://[^[:space:]]+$');

alter table public.knowledge_items
  add constraint knowledge_items_source_url_http_check
  check (
    source_url is null
    or (source_url = btrim(source_url) and source_url ~* '^https?://[^[:space:]]+$')
  );

revoke all on function private.reject_unsupported_capture_types() from public, anon, authenticated;

-- AI proposals may be submitted by a member, but only the approval command may
-- change their state or create an execution.
alter table public.ai_proposals
  add constraint ai_proposals_id_workspace_key unique (id, workspace_id);

alter table public.ai_proposals
  drop constraint ai_proposals_supersedes_id_fkey;
alter table public.ai_proposals
  add constraint ai_proposals_supersedes_workspace_fkey
  foreign key (supersedes_id, workspace_id)
  references public.ai_proposals(id, workspace_id)
  on delete restrict;

alter table public.ai_executions
  drop constraint ai_executions_proposal_id_fkey;
alter table public.ai_executions
  add constraint ai_executions_proposal_workspace_fkey
  foreign key (proposal_id, workspace_id)
  references public.ai_proposals(id, workspace_id)
  on delete restrict;

drop policy "members manage proposals" on public.ai_proposals;
create policy "members read proposals" on public.ai_proposals
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy "members create pending proposals" on public.ai_proposals
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and status = 'pending'
  and decided_at is null
);

drop policy "members create executions" on public.ai_executions;

revoke insert, update, delete on table public.ai_proposals from authenticated;
grant insert (
  id, workspace_id, command_name, command_args, preview_diff,
  source_entity_ids, risk, expected_versions, supersedes_id, expires_at
) on table public.ai_proposals to authenticated;
revoke insert on table public.ai_executions from authenticated;

-- Audit events are server-owned. Public command functions remain SECURITY
-- INVOKER for domain writes and delegate only the event append to this private,
-- fixed-search-path boundary.
create or replace function private.append_activity_event(
  event_workspace_id uuid,
  event_actor_user_id uuid,
  event_source text,
  event_command_name text,
  event_entity_ids uuid[],
  event_summary_diff jsonb,
  event_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or event_actor_user_id is distinct from (select auth.uid())
    or not private.is_workspace_member(event_workspace_id) then
    raise exception 'workspace_access_denied';
  end if;
  if event_source not in ('user', 'ai', 'integration', 'system') then
    raise exception 'invalid_activity_source';
  end if;
  if btrim(event_command_name) = '' then
    raise exception 'activity_command_name_required';
  end if;

  insert into public.activity_events (
    workspace_id, actor_user_id, source, command_name,
    entity_ids, summary_diff, correlation_id
  ) values (
    event_workspace_id, event_actor_user_id, event_source, event_command_name,
    coalesce(event_entity_ids, '{}'), coalesce(event_summary_diff, '{}'::jsonb), event_correlation_id
  );
end;
$$;

create or replace function private.append_activity_event_once(
  event_workspace_id uuid,
  event_actor_user_id uuid,
  event_source text,
  event_command_name text,
  event_entity_ids uuid[],
  event_summary_diff jsonb,
  event_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or event_actor_user_id is distinct from (select auth.uid())
    or not private.is_workspace_member(event_workspace_id) then
    raise exception 'workspace_access_denied';
  end if;
  if event_source not in ('user', 'ai', 'integration', 'system') then
    raise exception 'invalid_activity_source';
  end if;
  if btrim(event_command_name) = '' then
    raise exception 'activity_command_name_required';
  end if;

  insert into public.activity_events (
    workspace_id, actor_user_id, source, command_name,
    entity_ids, summary_diff, correlation_id
  ) values (
    event_workspace_id, event_actor_user_id, event_source, event_command_name,
    coalesce(event_entity_ids, '{}'), coalesce(event_summary_diff, '{}'::jsonb), event_correlation_id
  )
  on conflict (workspace_id, correlation_id) do nothing;
end;
$$;

revoke all on function private.append_activity_event(uuid, uuid, text, text, uuid[], jsonb, uuid) from public, anon, authenticated;
revoke all on function private.append_activity_event_once(uuid, uuid, text, text, uuid[], jsonb, uuid) from public, anon, authenticated;
grant execute on function private.append_activity_event(uuid, uuid, text, text, uuid[], jsonb, uuid) to authenticated;
grant execute on function private.append_activity_event_once(uuid, uuid, text, text, uuid[], jsonb, uuid) to authenticated;

-- Replace the event insert inside every current command without changing the
-- command signature or its domain-table RLS behavior. The migration fails if a
-- current function contains an event write that was not transformed.
do $migration$
declare
  command_function record;
  original_definition text;
  secured_definition text;
  rewritten_count integer := 0;
  event_insert_pattern text :=
    'insert\s+into\s+public\.activity_events\s*\(\s*workspace_id\s*,\s*actor_user_id\s*,\s*source\s*,\s*command_name\s*,\s*entity_ids\s*,\s*summary_diff\s*,\s*correlation_id\s*\)\s*values\s*\((.*?)\)\s*;';
  event_insert_once_pattern text :=
    'insert\s+into\s+public\.activity_events\s*\(\s*workspace_id\s*,\s*actor_user_id\s*,\s*source\s*,\s*command_name\s*,\s*entity_ids\s*,\s*summary_diff\s*,\s*correlation_id\s*\)\s*values\s*\((.*?)\)\s*on\s+conflict\s*\(\s*workspace_id\s*,\s*correlation_id\s*\)\s*do\s+nothing\s*;';
begin
  for command_function in
    select procedure.oid, procedure.proname
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
      and procedure.prosrc ilike '%insert into public.activity_events%'
      and procedure.proname not in ('approve_ai_proposal', 'reject_ai_proposal')
  loop
    original_definition := pg_get_functiondef(command_function.oid);
    secured_definition := regexp_replace(
      original_definition,
      event_insert_once_pattern,
      'perform private.append_activity_event_once(\1);',
      'gi'
    );
    secured_definition := regexp_replace(
      secured_definition,
      event_insert_pattern,
      'perform private.append_activity_event(\1);',
      'gi'
    );
    if secured_definition ilike '%insert into public.activity_events%' then
      raise exception 'activity_event_rewrite_failed:%', command_function.proname;
    end if;
    execute secured_definition;
    rewritten_count := rewritten_count + 1;
  end loop;

  if rewritten_count = 0 then
    raise exception 'activity_event_rewrite_found_no_commands';
  end if;
end;
$migration$;

create or replace function private.approve_ai_proposal_command(
  target_proposal_id uuid,
  command_idempotency_key uuid
)
returns public.ai_executions
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal_record public.ai_proposals;
  execution_record public.ai_executions;
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'authentication_required'; end if;

  select * into proposal_record
  from public.ai_proposals
  where id = target_proposal_id
  for update;
  if not found or not private.is_workspace_member(proposal_record.workspace_id) then
    raise exception 'proposal_not_found';
  end if;

  select * into execution_record
  from public.ai_executions
  where workspace_id = proposal_record.workspace_id
    and idempotency_key = command_idempotency_key;
  if found then
    if execution_record.proposal_id <> proposal_record.id then
      raise exception 'idempotency_key_conflict';
    end if;
    return execution_record;
  end if;

  if proposal_record.status <> 'pending' then raise exception 'proposal_not_pending'; end if;
  if proposal_record.expires_at <= now() then raise exception 'proposal_expired'; end if;

  update public.ai_proposals
  set status = 'approved', decided_at = now()
  where id = proposal_record.id;

  insert into public.ai_executions (
    workspace_id, proposal_id, status, requested_by, idempotency_key
  ) values (
    proposal_record.workspace_id, proposal_record.id, 'queued', actor_id, command_idempotency_key
  )
  returning * into execution_record;

  perform private.append_activity_event_once(
    proposal_record.workspace_id, actor_id, 'user', 'approve_ai_proposal', '{}',
    jsonb_build_object('proposalId', proposal_record.id, 'executionId', execution_record.id),
    command_idempotency_key
  );
  return execution_record;
end;
$$;

create or replace function private.reject_ai_proposal_command(
  target_proposal_id uuid,
  command_idempotency_key uuid
)
returns public.ai_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal_record public.ai_proposals;
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'authentication_required'; end if;

  select * into proposal_record
  from public.ai_proposals
  where id = target_proposal_id
  for update;
  if not found or not private.is_workspace_member(proposal_record.workspace_id) then
    raise exception 'proposal_not_found';
  end if;

  if proposal_record.status = 'rejected' and exists (
    select 1 from public.activity_events event
    where event.workspace_id = proposal_record.workspace_id
      and event.correlation_id = command_idempotency_key
      and event.command_name = 'reject_ai_proposal'
  ) then
    return proposal_record;
  end if;
  if proposal_record.status <> 'pending' then raise exception 'proposal_not_pending'; end if;

  update public.ai_proposals
  set status = 'rejected', decided_at = now()
  where id = proposal_record.id
  returning * into proposal_record;

  perform private.append_activity_event_once(
    proposal_record.workspace_id, actor_id, 'user', 'reject_ai_proposal', '{}',
    jsonb_build_object('proposalId', proposal_record.id), command_idempotency_key
  );
  return proposal_record;
end;
$$;

revoke all on function private.approve_ai_proposal_command(uuid, uuid) from public, anon, authenticated;
revoke all on function private.reject_ai_proposal_command(uuid, uuid) from public, anon, authenticated;
grant execute on function private.approve_ai_proposal_command(uuid, uuid) to authenticated;
grant execute on function private.reject_ai_proposal_command(uuid, uuid) to authenticated;

create or replace function public.approve_ai_proposal(
  target_proposal_id uuid,
  command_idempotency_key uuid
)
returns public.ai_executions
language sql
security invoker
set search_path = ''
as $$
  select private.approve_ai_proposal_command(target_proposal_id, command_idempotency_key);
$$;

create or replace function public.reject_ai_proposal(
  target_proposal_id uuid,
  command_idempotency_key uuid
)
returns public.ai_proposals
language sql
security invoker
set search_path = ''
as $$
  select private.reject_ai_proposal_command(target_proposal_id, command_idempotency_key);
$$;

revoke all on function public.approve_ai_proposal(uuid, uuid) from public, anon;
revoke all on function public.reject_ai_proposal(uuid, uuid) from public, anon;
grant execute on function public.approve_ai_proposal(uuid, uuid) to authenticated;
grant execute on function public.reject_ai_proposal(uuid, uuid) to authenticated;

drop policy "members create activity" on public.activity_events;
revoke insert on table public.activity_events from authenticated;
