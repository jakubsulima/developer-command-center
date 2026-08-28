-- AI-assisted triage is a read-only proposal until the user confirms an
-- existing typed triage command in the application.

alter table public.ai_runs drop constraint if exists ai_runs_capability_check;
alter table public.ai_runs add constraint ai_runs_capability_check check (capability in ('goal_portfolio_review', 'inbox_triage'));
alter table public.inbox_items add constraint inbox_items_id_workspace_key unique (id, workspace_id);

create table public.ai_inbox_triage_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  run_id uuid,
  inbox_item_id uuid not null references public.inbox_items(id) on delete cascade,
  source_snapshot_at timestamptz not null,
  context_hash text not null check (char_length(context_hash) = 64),
  prompt_version integer not null check (prompt_version > 0),
  schema_version integer not null check (schema_version > 0),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 200),
  proposal_json jsonb not null check (jsonb_typeof(proposal_json) = 'object'),
  created_at timestamptz not null default now(),
  cache_expires_at timestamptz not null,
  unique (id, workspace_id),
  foreign key (run_id, workspace_id) references public.ai_runs(id, workspace_id) on delete set null,
  foreign key (inbox_item_id, workspace_id) references public.inbox_items(id, workspace_id) on delete cascade
);

create table public.ai_inbox_triage_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('helpful', 'not_helpful')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (proposal_id, workspace_id) references public.ai_inbox_triage_proposals(id, workspace_id) on delete cascade,
  unique (proposal_id, user_id)
);

create index ai_inbox_triage_cache_idx on public.ai_inbox_triage_proposals(workspace_id, inbox_item_id, context_hash, prompt_version, model, created_at desc);
create index ai_inbox_triage_runs_idx on public.ai_runs(workspace_id, user_id, capability, created_at desc);

alter table public.ai_inbox_triage_proposals enable row level security;
alter table public.ai_inbox_triage_feedback enable row level security;

create policy "members read inbox triage proposals" on public.ai_inbox_triage_proposals for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "members read own inbox triage feedback" on public.ai_inbox_triage_feedback for select to authenticated
  using (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

revoke all on table public.ai_inbox_triage_proposals, public.ai_inbox_triage_feedback from public, anon, authenticated;
grant select on table public.ai_inbox_triage_proposals, public.ai_inbox_triage_feedback to authenticated;
grant all on table public.ai_inbox_triage_proposals, public.ai_inbox_triage_feedback to service_role;

create or replace function public.get_ai_inbox_triage_context(target_workspace_id uuid, target_inbox_item_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
select case when private.is_workspace_member(target_workspace_id) then jsonb_build_object(
  'workspaceId', target_workspace_id,
  'sourceSnapshotAt', now(),
  'inbox', jsonb_build_object('id', item.id, 'kind', item.kind, 'content', item.raw_content, 'createdAt', item.created_at, 'status', item.status),
  'goals', coalesce((select jsonb_agg(jsonb_build_object(
    'id', goal.id, 'title', goal.title, 'outcome', goal.outcome, 'priority', goal.priority,
    'targetDate', goal.target_date, 'areaId', goal.area_id
  ) order by case goal.priority when 'high' then 0 when 'normal' then 1 else 2 end, goal.target_date nulls last, goal.updated_at desc, goal.id)
    from (select goal.* from public.goals goal where goal.workspace_id = target_workspace_id and goal.status = 'active' and goal.archived_at is null and goal.trashed_at is null order by case goal.priority when 'high' then 0 when 'normal' then 1 else 2 end, goal.target_date nulls last, goal.updated_at desc, goal.id limit 50) goal), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(jsonb_build_object(
    'id', entity.id, 'title', entity.title, 'outcome', project.outcome, 'status', project.status
  ) order by entity.updated_at desc, entity.id)
    from public.entities entity join public.projects project on project.entity_id = entity.id and project.workspace_id = entity.workspace_id
    where entity.workspace_id = target_workspace_id and entity.type = 'project' and entity.archived_at is null and entity.trashed_at is null and project.status not in ('completed', 'abandoned') limit 50), '[]'::jsonb)
) else null end
from public.inbox_items item
where item.id = target_inbox_item_id and item.workspace_id = target_workspace_id;
$$;

revoke all on function public.get_ai_inbox_triage_context(uuid, uuid) from public, anon;
grant execute on function public.get_ai_inbox_triage_context(uuid, uuid) to authenticated, service_role;

create or replace function private.set_ai_inbox_triage_feedback(
  target_workspace_id uuid,
  target_proposal_id uuid,
  target_rating text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  if target_rating not in ('helpful', 'not_helpful') then raise exception 'invalid_feedback_rating'; end if;
  if not exists (select 1 from public.ai_inbox_triage_proposals proposal where proposal.id = target_proposal_id and proposal.workspace_id = target_workspace_id) then raise exception 'proposal_not_found'; end if;
  insert into public.ai_inbox_triage_feedback (workspace_id, proposal_id, user_id, rating)
  values (target_workspace_id, target_proposal_id, (select auth.uid()), target_rating)
  on conflict (proposal_id, user_id) do update set rating = excluded.rating, updated_at = now();
end;
$$;
revoke all on function private.set_ai_inbox_triage_feedback(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.set_ai_inbox_triage_feedback(uuid, uuid, text) to authenticated;

create or replace function public.set_ai_inbox_triage_feedback(target_workspace_id uuid, target_proposal_id uuid, target_rating text)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.set_ai_inbox_triage_feedback(target_workspace_id, target_proposal_id, target_rating); $$;
revoke all on function public.set_ai_inbox_triage_feedback(uuid, uuid, text) from public, anon;
grant execute on function public.set_ai_inbox_triage_feedback(uuid, uuid, text) to authenticated;

-- Extend the existing typed triage command with a date. A project suggestion is
-- represented by the projected goal id/area id in the current goal-centric model.
create or replace function public.triage_inbox_intent(
  target_workspace_id uuid,
  target_inbox_item_id uuid,
  target_intent jsonb,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.inbox_items;
declare target_id uuid;
declare goal_id uuid;
declare area_id uuid;
declare action_id uuid;
declare knowledge_id uuid;
declare link_id uuid;
declare intent_kind text := target_intent ->> 'kind';
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into target_id from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'triage_inbox_intent';
  if target_id is not null then return target_id; end if;
  select * into item from public.inbox_items where id = target_inbox_item_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'inbox_item_not_found'; end if;
  if item.status <> 'unprocessed' then raise exception 'inbox_item_not_available'; end if;
  if intent_kind = 'goal' then
    goal_id := (target_intent ->> 'goalId')::uuid;
    action_id := nullif(target_intent ->> 'actionId', '')::uuid;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'goal_title_required'; end if;
    if btrim(coalesce(target_intent ->> 'outcome', '')) = '' then raise exception 'goal_outcome_required'; end if;
    insert into public.goals (id, workspace_id, title, outcome, kind, area_id, target_date)
    values (goal_id, target_workspace_id, btrim(target_intent ->> 'title'), btrim(target_intent ->> 'outcome'), 'custom', nullif(target_intent ->> 'areaId', '')::uuid, nullif(target_intent ->> 'targetDate', '')::date);
    if btrim(coalesce(target_intent ->> 'firstActionTitle', '')) <> '' then
      insert into public.actions (id, workspace_id, goal_id, title, is_next)
      values (action_id, target_workspace_id, goal_id, btrim(target_intent ->> 'firstActionTitle'), true);
    end if;
    target_id := goal_id;
  elsif intent_kind = 'action' then
    action_id := (target_intent ->> 'actionId')::uuid;
    goal_id := nullif(target_intent ->> 'goalId', '')::uuid;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'action_title_required'; end if;
    insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, pinned_to_today, scheduled_for)
    values (action_id, target_workspace_id, goal_id, nullif(target_intent ->> 'areaId', '')::uuid,
      btrim(target_intent ->> 'title'), btrim(coalesce(target_intent ->> 'detail', '')),
      coalesce((target_intent ->> 'pinnedToToday')::boolean, false), nullif(target_intent ->> 'targetDate', '')::date);
    target_id := action_id;
  elsif intent_kind = 'knowledge' then
    knowledge_id := (target_intent ->> 'knowledgeId')::uuid;
    goal_id := nullif(target_intent ->> 'goalId', '')::uuid;
    area_id := nullif(target_intent ->> 'projectId', '')::uuid;
    link_id := nullif(target_intent ->> 'linkId', '')::uuid;
    if goal_id is not null and area_id is not null then raise exception 'knowledge_multiple_targets'; end if;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'knowledge_title_required'; end if;
    if target_intent ->> 'knowledgeKind' not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
    insert into public.entities (id, workspace_id, type, title)
    values (knowledge_id, target_workspace_id, (target_intent ->> 'knowledgeKind')::public.entity_type, btrim(target_intent ->> 'title'));
    insert into public.knowledge_items (entity_id, workspace_id, detail, source_url, source_inbox_item_id)
    values (knowledge_id, target_workspace_id, btrim(coalesce(target_intent ->> 'detail', '')), nullif(btrim(coalesce(target_intent ->> 'sourceUrl', '')), ''), item.id);
    if goal_id is not null then
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, goal_id, meaning)
      values (link_id, target_workspace_id, knowledge_id, goal_id,
        case target_intent ->> 'knowledgeKind' when 'decision' then 'decision' when 'artifact' then 'result' else 'material' end);
    elsif area_id is not null then
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, area_id, meaning)
      values (link_id, target_workspace_id, knowledge_id, area_id,
        case target_intent ->> 'knowledgeKind' when 'decision' then 'decision' when 'artifact' then 'result' else 'material' end);
    end if;
    target_id := knowledge_id;
  else
    raise exception 'invalid_inbox_intent';
  end if;
  update public.inbox_items set status = 'resolved', resolved_at = now(), snoozed_until = null where id = item.id;
  perform private.append_activity_event_once(
    target_workspace_id, (select auth.uid()), 'user', 'triage_inbox_intent', array[target_id],
    jsonb_build_object('inboxItemId', item.id, 'intent', intent_kind), command_idempotency_key
  );
  return target_id;
end;
$$;
revoke all on function public.triage_inbox_intent(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.triage_inbox_intent(uuid, uuid, jsonb, uuid) to authenticated;
