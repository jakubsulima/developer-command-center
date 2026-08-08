create or replace function public.create_goal_with_action_v2(
  target_workspace_id uuid, target_goal_id uuid, target_action_id uuid,
  goal_title text, goal_outcome text, goal_kind text, target_area_id uuid,
  first_action_title text, first_action_detail text, goal_criteria jsonb,
  command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare created_goal public.goals;
declare criterion jsonb;
declare criterion_position integer := 0;
begin
  created_goal := public.create_goal_with_action(target_workspace_id, target_goal_id, target_action_id,
    goal_title, goal_outcome, goal_kind, target_area_id, first_action_title, first_action_detail,
    command_idempotency_key);
  if jsonb_typeof(coalesce(goal_criteria, '[]'::jsonb)) <> 'array' then raise exception 'goal_criteria_must_be_array'; end if;
  for criterion in select value from jsonb_array_elements(coalesce(goal_criteria, '[]'::jsonb)) loop
    if btrim(coalesce(criterion ->> 'title', '')) = '' then raise exception 'goal_criterion_title_required'; end if;
    insert into public.goal_criteria (id, workspace_id, goal_id, title, completed, position)
    values ((criterion ->> 'id')::uuid, target_workspace_id, target_goal_id, btrim(criterion ->> 'title'),
      coalesce((criterion ->> 'completed')::boolean, false), criterion_position)
    on conflict (id) do update set title = excluded.title, completed = excluded.completed, position = excluded.position;
    criterion_position := criterion_position + 1;
  end loop;
  return created_goal;
end;
$$;

create or replace function public.update_goal_details(
  target_goal_id uuid, goal_changes jsonb, command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.goals;
declare criterion jsonb;
declare criterion_ids uuid[] := '{}';
declare criterion_position integer := 0;
begin
  select * into item from public.goals where id = target_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  if goal_changes ? 'title' and btrim(coalesce(goal_changes ->> 'title', '')) = '' then raise exception 'goal_title_required'; end if;
  if goal_changes ? 'outcome' and btrim(coalesce(goal_changes ->> 'outcome', '')) = '' then raise exception 'goal_outcome_required'; end if;
  update public.goals set
    title = case when goal_changes ? 'title' then btrim(goal_changes ->> 'title') else title end,
    outcome = case when goal_changes ? 'outcome' then btrim(goal_changes ->> 'outcome') else outcome end,
    area_id = case when goal_changes ? 'areaId' then nullif(goal_changes ->> 'areaId', '')::uuid else area_id end,
    priority = case when goal_changes ? 'priority' then goal_changes ->> 'priority' else priority end,
    target_date = case when goal_changes ? 'targetDate' then nullif(goal_changes ->> 'targetDate', '')::date else target_date end,
    updated_at = now(), version = version + 1
  where id = target_goal_id returning * into item;
  if goal_changes ? 'criteria' then
    if jsonb_typeof(goal_changes -> 'criteria') <> 'array' then raise exception 'goal_criteria_must_be_array'; end if;
    for criterion in select value from jsonb_array_elements(goal_changes -> 'criteria') loop
      if btrim(coalesce(criterion ->> 'title', '')) = '' then raise exception 'goal_criterion_title_required'; end if;
      criterion_ids := array_append(criterion_ids, (criterion ->> 'id')::uuid);
      insert into public.goal_criteria (id, workspace_id, goal_id, title, completed, position)
      values ((criterion ->> 'id')::uuid, item.workspace_id, item.id, btrim(criterion ->> 'title'),
        coalesce((criterion ->> 'completed')::boolean, false), criterion_position)
      on conflict (id) do update set title = excluded.title, completed = excluded.completed, position = excluded.position;
      criterion_position := criterion_position + 1;
    end loop;
    delete from public.goal_criteria where goal_id = item.id and not (id = any(criterion_ids));
  end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'update_goal_details', array[item.id], goal_changes, command_idempotency_key);
  return item;
end;
$$;

create or replace function public.release_due_inbox_items(target_workspace_id uuid, command_idempotency_key uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare released_count integer;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  update public.inbox_items set status = 'unprocessed', snoozed_until = null
    where workspace_id = target_workspace_id and status = 'snoozed' and snoozed_until <= now();
  get diagnostics released_count = row_count;
  if released_count > 0 then
    insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
    values (target_workspace_id, (select auth.uid()), 'system', 'release_due_inbox_items', '{}', jsonb_build_object('released', released_count), command_idempotency_key)
    on conflict (workspace_id, correlation_id) do nothing;
  end if;
  return released_count;
end;
$$;

create or replace function public.set_goal_outcome_status(
  target_goal_id uuid, target_status text, change_reason text, target_progress_id uuid,
  target_progress_content text, command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.goals;
begin
  if target_status not in ('active', 'paused', 'achieved', 'abandoned') then raise exception 'invalid_goal_status'; end if;
  if target_status = 'abandoned' and btrim(coalesce(change_reason, '')) = '' then raise exception 'goal_abandon_reason_required'; end if;
  select * into item from public.goals where id = target_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  update public.goals set status = target_status, updated_at = now(), version = version + 1
    where id = target_goal_id returning * into item;
  insert into public.progress_entries (id, workspace_id, goal_id, kind, content)
  values (target_progress_id, item.workspace_id, item.id, 'decision', btrim(target_progress_content))
  on conflict (id) do nothing;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_goal_outcome_status', array[item.id],
    jsonb_build_object('status', target_status, 'reason', nullif(btrim(coalesce(change_reason, '')), '')), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return item;
end;
$$;

create or replace function private.reject_unsupported_capture_types()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind in ('voice', 'file') then raise exception 'capture_asset_required'; end if;
  if new.kind = 'link' and btrim(new.raw_content) !~* '^https?://[^[:space:]]+$' then raise exception 'invalid_capture_url'; end if;
  return new;
end;
$$;
drop trigger if exists inbox_require_real_asset on public.inbox_items;
create trigger inbox_require_real_asset before insert on public.inbox_items
for each row execute function private.reject_unsupported_capture_types();

create or replace function public.create_knowledge_with_goal_links(
  target_workspace_id uuid, target_knowledge_id uuid, knowledge_kind text,
  knowledge_title text, knowledge_detail text, knowledge_source_url text,
  goal_links jsonb, link_meaning text, command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare link jsonb;
declare existing_id uuid;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into existing_id from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key and event.command_name = 'create_knowledge_with_goal_links';
  if existing_id is not null then return existing_id; end if;
  if knowledge_kind not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
  if link_meaning not in ('material', 'result', 'decision', 'reference') then raise exception 'invalid_knowledge_link_meaning'; end if;
  if btrim(coalesce(knowledge_title, '')) = '' then raise exception 'knowledge_title_required'; end if;
  if nullif(btrim(coalesce(knowledge_source_url, '')), '') is not null
    and btrim(knowledge_source_url) !~* '^https?://[^[:space:]]+$' then raise exception 'invalid_knowledge_source_url'; end if;
  if jsonb_typeof(coalesce(goal_links, '[]'::jsonb)) <> 'array' then raise exception 'goal_links_must_be_array'; end if;
  insert into public.entities (id, workspace_id, type, title)
  values (target_knowledge_id, target_workspace_id, knowledge_kind::public.entity_type, btrim(knowledge_title));
  insert into public.knowledge_items (entity_id, workspace_id, detail, source_url)
  values (target_knowledge_id, target_workspace_id, btrim(coalesce(knowledge_detail, '')), nullif(btrim(coalesce(knowledge_source_url, '')), ''));
  for link in select value from jsonb_array_elements(coalesce(goal_links, '[]'::jsonb)) loop
    if not exists (select 1 from public.goals where id = (link ->> 'goalId')::uuid and workspace_id = target_workspace_id) then raise exception 'goal_not_found'; end if;
    insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, goal_id, meaning)
    values ((link ->> 'id')::uuid, target_workspace_id, target_knowledge_id, (link ->> 'goalId')::uuid, link_meaning)
    on conflict do nothing;
  end loop;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'create_knowledge_with_goal_links', array[target_knowledge_id], jsonb_build_object('kind', knowledge_kind, 'links', jsonb_array_length(coalesce(goal_links, '[]'::jsonb))), command_idempotency_key);
  return target_knowledge_id;
end;
$$;

create or replace function public.update_knowledge_item(
  target_knowledge_id uuid, knowledge_changes jsonb, goal_links jsonb, command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.entities;
declare link jsonb;
declare retained_goal_ids uuid[] := '{}';
begin
  select * into item from public.entities where id = target_knowledge_id for update;
  if not found or item.type not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'knowledge_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item.id; end if;
  if knowledge_changes ? 'title' and btrim(coalesce(knowledge_changes ->> 'title', '')) = '' then raise exception 'knowledge_title_required'; end if;
  if knowledge_changes ? 'kind' and knowledge_changes ->> 'kind' not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
  if knowledge_changes ? 'sourceUrl' and nullif(btrim(coalesce(knowledge_changes ->> 'sourceUrl', '')), '') is not null
    and btrim(knowledge_changes ->> 'sourceUrl') !~* '^https?://[^[:space:]]+$' then raise exception 'invalid_knowledge_source_url'; end if;
  update public.entities set
    title = case when knowledge_changes ? 'title' then btrim(knowledge_changes ->> 'title') else title end,
    type = case when knowledge_changes ? 'kind' then (knowledge_changes ->> 'kind')::public.entity_type else type end,
    updated_at = now(), version = version + 1
  where id = item.id;
  update public.knowledge_items set
    detail = case when knowledge_changes ? 'detail' then btrim(coalesce(knowledge_changes ->> 'detail', '')) else detail end,
    source_url = case when knowledge_changes ? 'sourceUrl' then nullif(btrim(coalesce(knowledge_changes ->> 'sourceUrl', '')), '') else source_url end,
    updated_at = now()
  where entity_id = item.id;
  if goal_links is not null then
    if jsonb_typeof(goal_links) <> 'array' then raise exception 'goal_links_must_be_array'; end if;
    for link in select value from jsonb_array_elements(goal_links) loop
      if not exists (select 1 from public.goals where id = (link ->> 'goalId')::uuid and workspace_id = item.workspace_id) then raise exception 'goal_not_found'; end if;
      retained_goal_ids := array_append(retained_goal_ids, (link ->> 'goalId')::uuid);
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, goal_id, meaning)
      values ((link ->> 'id')::uuid, item.workspace_id, item.id, (link ->> 'goalId')::uuid,
        case when coalesce(knowledge_changes ->> 'kind', item.type::text) = 'decision' then 'decision'
          when coalesce(knowledge_changes ->> 'kind', item.type::text) = 'artifact' then 'result' else 'reference' end)
      on conflict do nothing;
    end loop;
    delete from public.knowledge_links
      where knowledge_entity_id = item.id and goal_id is not null and not (goal_id = any(retained_goal_ids));
  end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'update_knowledge_item', array[item.id], knowledge_changes, command_idempotency_key);
  return item.id;
end;
$$;

create or replace function public.update_action_checked(
  target_action_id uuid, expected_version integer, action_changes jsonb, command_idempotency_key uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.actions;
begin
  select * into item from public.actions where id = target_action_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  if item.version <> expected_version then raise exception 'action_version_conflict'; end if;
  if action_changes ? 'title' and btrim(coalesce(action_changes ->> 'title', '')) = '' then raise exception 'action_title_required'; end if;
  if action_changes ? 'checklist' and jsonb_typeof(action_changes -> 'checklist') <> 'array' then raise exception 'action_checklist_must_be_array'; end if;
  update public.actions set
    title = case when action_changes ? 'title' then btrim(action_changes ->> 'title') else title end,
    detail = case when action_changes ? 'detail' then btrim(coalesce(action_changes ->> 'detail', '')) else detail end,
    scheduled_for = case when action_changes ? 'scheduledFor' then nullif(action_changes ->> 'scheduledFor', '')::date else scheduled_for end,
    pinned_to_today = case when action_changes ? 'pinnedToToday' then (action_changes ->> 'pinnedToToday')::boolean else pinned_to_today end,
    goal_id = case when action_changes ? 'goalId' then nullif(action_changes ->> 'goalId', '')::uuid else goal_id end,
    area_id = case when action_changes ? 'areaId' then nullif(action_changes ->> 'areaId', '')::uuid else area_id end,
    position = case when action_changes ? 'position' then (action_changes ->> 'position')::integer else position end,
    checklist = case when action_changes ? 'checklist' then action_changes -> 'checklist' else checklist end,
    updated_at = now(), version = version + 1
  where id = item.id returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'update_action_checked', array[item.id], action_changes, command_idempotency_key);
  return item;
end;
$$;

create or replace function public.set_action_status_checked(
  target_action_id uuid, target_status text, target_blocker text, command_idempotency_key uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.actions;
declare previous_status text;
declare previous_blocker text;
begin
  if target_status not in ('ready', 'in_progress', 'blocked', 'completed', 'skipped', 'cancelled') then raise exception 'invalid_action_status'; end if;
  if target_status = 'blocked' and btrim(coalesce(target_blocker, '')) = '' then raise exception 'action_blocker_required'; end if;
  select * into item from public.actions where id = target_action_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  if item.status = target_status and (target_status <> 'blocked' or item.blocker = btrim(target_blocker)) then return item; end if;
  previous_status := item.status;
  previous_blocker := item.blocker;
  update public.actions set
    status = target_status,
    blocker = case when target_status = 'blocked' then btrim(target_blocker) else null end,
    completed_at = case when target_status = 'completed' then now() else null end,
    skipped_at = case when target_status = 'skipped' then now() else null end,
    cancelled_at = case when target_status = 'cancelled' then now() else null end,
    is_next = case when target_status in ('ready', 'in_progress') then is_next else false end,
    updated_at = now(), version = version + 1
  where id = item.id returning * into item;
  if item.goal_id is not null and (target_status = 'blocked' or previous_status = 'blocked') then
    insert into public.progress_entries (id, workspace_id, goal_id, action_id, kind, content)
    values (command_idempotency_key, item.workspace_id, item.goal_id, item.id, 'blocker',
      case when target_status = 'blocked' then 'Zablokowano: ' || btrim(target_blocker)
        else 'Odblokowano. Poprzedni powód: ' || coalesce(previous_blocker, 'brak') end)
    on conflict (id) do nothing;
  end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_action_status_checked', array[item.id],
    jsonb_build_object('from', previous_status, 'to', target_status), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.create_action_item(
  target_workspace_id uuid, target_action_id uuid, target_goal_id uuid, target_area_id uuid,
  action_title text, action_detail text, action_scheduled_for date, action_pinned_to_today boolean,
  command_idempotency_key uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.actions;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  if btrim(coalesce(action_title, '')) = '' then raise exception 'action_title_required'; end if;
  select action.* into item from public.activity_events event
    join public.actions action on action.id = event.entity_ids[1]
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'create_action_item';
  if found then return item; end if;
  if target_goal_id is not null and not exists (select 1 from public.goals where id = target_goal_id and workspace_id = target_workspace_id) then raise exception 'goal_not_found'; end if;
  if target_area_id is not null and not exists (select 1 from public.areas where id = target_area_id and workspace_id = target_workspace_id) then raise exception 'area_not_found'; end if;
  insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, scheduled_for, pinned_to_today, position)
  values (target_action_id, target_workspace_id, target_goal_id, target_area_id, btrim(action_title), btrim(coalesce(action_detail, '')),
    action_scheduled_for, coalesce(action_pinned_to_today, false),
    coalesce((select max(position) + 1 from public.actions where workspace_id = target_workspace_id and goal_id is not distinct from target_goal_id), 0))
  returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'create_action_item', array[item.id],
    jsonb_build_object('goalId', target_goal_id, 'areaId', target_area_id), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.set_next_action_checked(
  target_goal_id uuid, target_action_id uuid, command_idempotency_key uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.actions;
begin
  select * into item from public.actions where id = target_action_id and goal_id = target_goal_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if item.status not in ('ready', 'in_progress') then raise exception 'next_action_not_ready'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  update public.actions set is_next = false, updated_at = now() where goal_id = target_goal_id and is_next;
  update public.actions set is_next = true, updated_at = now() where id = target_action_id returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_next_action_checked', array[item.id],
    jsonb_build_object('goalId', target_goal_id), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.set_goal_visibility_checked(
  target_goal_id uuid, target_visibility text, command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.goals;
begin
  if target_visibility not in ('active', 'archived', 'trashed') then raise exception 'invalid_visibility'; end if;
  select * into item from public.goals where id = target_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  update public.goals set
    archived_at = case when target_visibility = 'archived' then now() else null end,
    trashed_at = case when target_visibility = 'trashed' then now() else null end,
    updated_at = now(), version = version + 1
  where id = item.id returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_goal_visibility_checked', array[item.id],
    jsonb_build_object('visibility', target_visibility), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.create_recurring_action_template(
  target_workspace_id uuid, target_template_id uuid, template_data jsonb,
  command_idempotency_key uuid
)
returns public.recurring_action_templates
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.recurring_action_templates;
declare target_goal_id uuid := nullif(template_data ->> 'goalId', '')::uuid;
declare target_area_id uuid := nullif(template_data ->> 'areaId', '')::uuid;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select template.* into item from public.activity_events event
    join public.recurring_action_templates template on template.id = event.entity_ids[1]
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'create_recurring_action_template';
  if found then return item; end if;
  if btrim(coalesce(template_data ->> 'title', '')) = '' then raise exception 'recurring_title_required'; end if;
  if nullif(template_data ->> 'startsOn', '') is null then raise exception 'recurring_start_required'; end if;
  if jsonb_typeof(coalesce(template_data -> 'rule', 'null'::jsonb)) <> 'object' then raise exception 'recurring_rule_required'; end if;
  if jsonb_typeof(coalesce(template_data -> 'checklist', '[]'::jsonb)) <> 'array' then raise exception 'recurring_checklist_must_be_array'; end if;
  if coalesce(template_data ->> 'missedPolicy', 'skip_missed') not in ('skip_missed', 'carry_one') then raise exception 'invalid_missed_policy'; end if;
  if target_goal_id is not null and not exists (select 1 from public.goals where id = target_goal_id and workspace_id = target_workspace_id) then raise exception 'goal_not_found'; end if;
  if target_area_id is not null and not exists (select 1 from public.areas where id = target_area_id and workspace_id = target_workspace_id) then raise exception 'area_not_found'; end if;
  insert into public.recurring_action_templates (
    id, workspace_id, title, detail, goal_id, area_id, timezone, starts_on,
    recurrence_rule, missed_policy, status, checklist
  ) values (
    target_template_id, target_workspace_id, btrim(template_data ->> 'title'), btrim(coalesce(template_data ->> 'detail', '')),
    target_goal_id, target_area_id, coalesce(nullif(template_data ->> 'timezone', ''), 'Europe/Warsaw'),
    (template_data ->> 'startsOn')::date, template_data -> 'rule', coalesce(template_data ->> 'missedPolicy', 'skip_missed'),
    'active', coalesce(template_data -> 'checklist', '[]'::jsonb)
  ) returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'create_recurring_action_template', array[item.id],
    jsonb_build_object('startsOn', item.starts_on, 'rule', item.recurrence_rule), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.update_recurring_action_template(
  target_template_id uuid, template_changes jsonb, update_future_actions boolean,
  effective_from date, command_idempotency_key uuid
)
returns public.recurring_action_templates
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.recurring_action_templates;
declare target_goal_id uuid := nullif(template_changes ->> 'goalId', '')::uuid;
declare target_area_id uuid := nullif(template_changes ->> 'areaId', '')::uuid;
begin
  select * into item from public.recurring_action_templates where id = target_template_id for update;
  if not found then raise exception 'recurring_template_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  if template_changes ? 'title' and btrim(coalesce(template_changes ->> 'title', '')) = '' then raise exception 'recurring_title_required'; end if;
  if template_changes ? 'startsOn' and nullif(template_changes ->> 'startsOn', '') is null then raise exception 'recurring_start_required'; end if;
  if template_changes ? 'rule' and jsonb_typeof(template_changes -> 'rule') <> 'object' then raise exception 'recurring_rule_required'; end if;
  if template_changes ? 'checklist' and jsonb_typeof(template_changes -> 'checklist') <> 'array' then raise exception 'recurring_checklist_must_be_array'; end if;
  if template_changes ? 'missedPolicy' and template_changes ->> 'missedPolicy' not in ('skip_missed', 'carry_one') then raise exception 'invalid_missed_policy'; end if;
  if template_changes ? 'goalId' and target_goal_id is not null and not exists (select 1 from public.goals where id = target_goal_id and workspace_id = item.workspace_id) then raise exception 'goal_not_found'; end if;
  if template_changes ? 'areaId' and target_area_id is not null and not exists (select 1 from public.areas where id = target_area_id and workspace_id = item.workspace_id) then raise exception 'area_not_found'; end if;
  update public.recurring_action_templates set
    title = case when template_changes ? 'title' then btrim(template_changes ->> 'title') else title end,
    detail = case when template_changes ? 'detail' then btrim(coalesce(template_changes ->> 'detail', '')) else detail end,
    goal_id = case when template_changes ? 'goalId' then target_goal_id else goal_id end,
    area_id = case when template_changes ? 'areaId' then target_area_id else area_id end,
    timezone = case when template_changes ? 'timezone' then template_changes ->> 'timezone' else timezone end,
    starts_on = case when template_changes ? 'startsOn' then (template_changes ->> 'startsOn')::date else starts_on end,
    recurrence_rule = case when template_changes ? 'rule' then template_changes -> 'rule' else recurrence_rule end,
    missed_policy = case when template_changes ? 'missedPolicy' then template_changes ->> 'missedPolicy' else missed_policy end,
    checklist = case when template_changes ? 'checklist' then template_changes -> 'checklist' else checklist end,
    updated_at = now(), version = version + 1
  where id = item.id returning * into item;
  if coalesce(update_future_actions, false) then
    update public.actions set
      title = case when template_changes ? 'title' then btrim(template_changes ->> 'title') else title end,
      detail = case when template_changes ? 'detail' then btrim(coalesce(template_changes ->> 'detail', '')) else detail end,
      goal_id = case when template_changes ? 'goalId' then target_goal_id else goal_id end,
      area_id = case when template_changes ? 'areaId' then target_area_id else area_id end,
      checklist = case when template_changes ? 'checklist' then template_changes -> 'checklist' else checklist end,
      updated_at = now(), version = version + 1
    where recurring_template_id = item.id and occurrence_date >= effective_from
      and status in ('ready', 'in_progress', 'blocked');
  end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'update_recurring_action_template', array[item.id],
    template_changes || jsonb_build_object('updateFutureActions', coalesce(update_future_actions, false), 'effectiveFrom', effective_from), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.set_recurring_action_template_status(
  target_template_id uuid, target_status text, command_idempotency_key uuid
)
returns public.recurring_action_templates
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.recurring_action_templates;
begin
  if target_status not in ('active', 'paused', 'archived') then raise exception 'invalid_recurring_status'; end if;
  select * into item from public.recurring_action_templates where id = target_template_id for update;
  if not found then raise exception 'recurring_template_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  update public.recurring_action_templates set status = target_status,
    archived_at = case when target_status = 'archived' then now() else null end,
    updated_at = now(), version = version + 1
    where id = item.id returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_recurring_action_template_status', array[item.id],
    jsonb_build_object('status', target_status), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.set_entity_visibility(
  target_entity_id uuid, target_visibility text, command_idempotency_key uuid
)
returns public.entities
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.entities;
begin
  if target_visibility not in ('active', 'archived', 'trashed') then raise exception 'invalid_visibility'; end if;
  select * into item from public.entities where id = target_entity_id for update;
  if not found then raise exception 'entity_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  update public.entities set
    archived_at = case when target_visibility = 'archived' then now() else null end,
    trashed_at = case when target_visibility = 'trashed' then now() else null end,
    version = version + 1, updated_at = now()
  where id = item.id returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_entity_visibility', array[item.id],
    jsonb_build_object('visibility', target_visibility), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.set_inbox_item_status(
  target_inbox_item_id uuid, target_status public.inbox_status,
  target_snoozed_until timestamptz, command_idempotency_key uuid
)
returns public.inbox_items
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.inbox_items;
begin
  if target_status = 'snoozed' and target_snoozed_until is null then raise exception 'snooze_date_required'; end if;
  select * into item from public.inbox_items where id = target_inbox_item_id for update;
  if not found then raise exception 'inbox_item_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  update public.inbox_items set
    status = target_status,
    snoozed_until = case when target_status = 'snoozed' then target_snoozed_until else null end,
    discarded_at = case when target_status = 'discarded' then now() else null end,
    resolved_at = case when target_status = 'resolved' then coalesce(resolved_at, now()) else null end
  where id = item.id returning * into item;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_inbox_item_status', array[item.id],
    jsonb_build_object('status', target_status), command_idempotency_key);
  return item;
end;
$$;

revoke all on function public.create_goal_with_action_v2(uuid, uuid, uuid, text, text, text, uuid, text, text, jsonb, uuid),
  public.update_goal_details(uuid, jsonb, uuid), public.release_due_inbox_items(uuid, uuid),
  public.set_goal_outcome_status(uuid, text, text, uuid, text, uuid),
  public.update_knowledge_item(uuid, jsonb, jsonb, uuid), public.update_action_checked(uuid, integer, jsonb, uuid), public.set_action_status_checked(uuid, text, text, uuid),
  public.create_action_item(uuid, uuid, uuid, uuid, text, text, date, boolean, uuid), public.set_next_action_checked(uuid, uuid, uuid),
  public.set_goal_visibility_checked(uuid, text, uuid), public.create_recurring_action_template(uuid, uuid, jsonb, uuid),
  public.update_recurring_action_template(uuid, jsonb, boolean, date, uuid), public.set_recurring_action_template_status(uuid, text, uuid),
  public.set_entity_visibility(uuid, text, uuid), public.set_inbox_item_status(uuid, public.inbox_status, timestamptz, uuid),
  public.create_knowledge_with_goal_links(uuid, uuid, text, text, text, text, jsonb, text, uuid) from public, anon;
grant execute on function public.create_goal_with_action_v2(uuid, uuid, uuid, text, text, text, uuid, text, text, jsonb, uuid),
  public.update_goal_details(uuid, jsonb, uuid), public.release_due_inbox_items(uuid, uuid),
  public.set_goal_outcome_status(uuid, text, text, uuid, text, uuid),
  public.update_knowledge_item(uuid, jsonb, jsonb, uuid), public.update_action_checked(uuid, integer, jsonb, uuid), public.set_action_status_checked(uuid, text, text, uuid),
  public.create_action_item(uuid, uuid, uuid, uuid, text, text, date, boolean, uuid), public.set_next_action_checked(uuid, uuid, uuid),
  public.set_goal_visibility_checked(uuid, text, uuid), public.create_recurring_action_template(uuid, uuid, jsonb, uuid),
  public.update_recurring_action_template(uuid, jsonb, boolean, date, uuid), public.set_recurring_action_template_status(uuid, text, uuid),
  public.set_entity_visibility(uuid, text, uuid), public.set_inbox_item_status(uuid, public.inbox_status, timestamptz, uuid),
  public.create_knowledge_with_goal_links(uuid, uuid, text, text, text, text, jsonb, text, uuid) to authenticated;
