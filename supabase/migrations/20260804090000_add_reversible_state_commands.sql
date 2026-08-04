alter table public.inbox_items add column if not exists snoozed_until timestamptz;
alter table public.inbox_items add column if not exists discarded_at timestamptz;

create or replace function public.set_entity_visibility(
  target_entity_id uuid,
  target_visibility text,
  command_idempotency_key uuid
)
returns public.entities
language plpgsql
security invoker
set search_path = ''
as $$
declare entity_record public.entities;
begin
  if target_visibility not in ('active', 'archived', 'trashed') then raise exception 'invalid_visibility'; end if;
  update public.entities set
    archived_at = case when target_visibility = 'archived' then now() else null end,
    trashed_at = case when target_visibility = 'trashed' then now() else null end,
    version = version + 1,
    updated_at = now()
  where id = target_entity_id returning * into entity_record;
  if not found then raise exception 'entity_not_found'; end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (entity_record.workspace_id, (select auth.uid()), 'user', 'set_entity_visibility', array[target_entity_id], jsonb_build_object('visibility', target_visibility), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return entity_record;
end;
$$;

create or replace function public.set_inbox_item_status(
  target_inbox_item_id uuid,
  target_status public.inbox_status,
  target_snoozed_until timestamptz,
  command_idempotency_key uuid
)
returns public.inbox_items
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.inbox_items;
begin
  if target_status = 'snoozed' and target_snoozed_until is null then raise exception 'snooze_date_required'; end if;
  update public.inbox_items set
    status = target_status,
    snoozed_until = case when target_status = 'snoozed' then target_snoozed_until else null end,
    discarded_at = case when target_status = 'discarded' then now() else null end,
    resolved_at = case when target_status = 'resolved' then coalesce(resolved_at, now()) else null end
  where id = target_inbox_item_id returning * into item;
  if not found then raise exception 'inbox_item_not_found'; end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_inbox_item_status', '{}', jsonb_build_object('inboxItemId', item.id, 'status', target_status), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return item;
end;
$$;

create or replace function public.set_commitment_status(
  target_project_id uuid,
  target_status public.commitment_status,
  command_idempotency_key uuid
)
returns public.commitments
language plpgsql
security invoker
set search_path = ''
as $$
declare commitment_record public.commitments;
declare fallback_id uuid;
begin
  select * into commitment_record from public.commitments
  where target_entity_id = target_project_id order by started_at desc limit 1 for update;
  if not found then raise exception 'commitment_not_found'; end if;
  update public.commitments set status = target_status, is_primary = false,
    ended_at = case when target_status in ('released', 'fulfilled') then now() else null end
  where id = commitment_record.id returning * into commitment_record;
  if target_status = 'active' and not exists (
    select 1 from public.commitments where workspace_id = commitment_record.workspace_id and status = 'active' and is_primary
  ) then
    update public.commitments set is_primary = true where id = commitment_record.id returning * into commitment_record;
  elsif target_status <> 'active' and not exists (
    select 1 from public.commitments where workspace_id = commitment_record.workspace_id and status = 'active' and is_primary
  ) then
    select id into fallback_id from public.commitments
    where workspace_id = commitment_record.workspace_id and status = 'active' order by started_at limit 1;
    if fallback_id is not null then update public.commitments set is_primary = true where id = fallback_id; end if;
  end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (commitment_record.workspace_id, (select auth.uid()), 'user', 'set_commitment_status', array[target_project_id], jsonb_build_object('status', target_status), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return commitment_record;
end;
$$;

create or replace function public.set_learning_goal_status(
  target_goal_id uuid,
  target_status text,
  change_reason text,
  command_idempotency_key uuid
)
returns public.learning_goals
language plpgsql
security invoker
set search_path = ''
as $$
declare goal public.learning_goals;
begin
  if target_status not in ('draft', 'shaped', 'achieved', 'abandoned') then raise exception 'invalid_learning_goal_status'; end if;
  if target_status = 'abandoned' and btrim(coalesce(change_reason, '')) = '' then raise exception 'learning_goal_abandon_reason_required'; end if;
  update public.learning_goals set status = target_status where entity_id = target_goal_id returning * into goal;
  if not found then raise exception 'learning_goal_not_found'; end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (goal.workspace_id, (select auth.uid()), 'user', 'set_learning_goal_status', array[target_goal_id], jsonb_build_object('status', target_status, 'reason', change_reason), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return goal;
end;
$$;

revoke all on function public.set_entity_visibility(uuid, text, uuid), public.set_inbox_item_status(uuid, public.inbox_status, timestamptz, uuid), public.set_commitment_status(uuid, public.commitment_status, uuid), public.set_learning_goal_status(uuid, text, text, uuid) from public, anon;
grant execute on function public.set_entity_visibility(uuid, text, uuid), public.set_inbox_item_status(uuid, public.inbox_status, timestamptz, uuid), public.set_commitment_status(uuid, public.commitment_status, uuid), public.set_learning_goal_status(uuid, text, text, uuid) to authenticated;
