-- Undo completion and restore the previous next-action marker in one checked write.
create function private.activity_command_was_applied(
  target_workspace_id uuid,
  target_command_id uuid,
  target_command_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  return exists (
    select 1 from public.activity_events
    where workspace_id = target_workspace_id
      and command_name = target_command_name
      and correlation_id = target_command_id
  );
end;
$$;

revoke all on function private.activity_command_was_applied(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.activity_command_was_applied(uuid, uuid, text) to authenticated;

create function public.undo_action_completion_checked(
  target_action_id uuid,
  target_goal_id uuid,
  expected_version integer,
  restore_status text,
  restore_blocker text,
  restore_review_on date,
  restore_is_next boolean,
  command_idempotency_key uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.actions;
begin
  if restore_status not in ('ready', 'in_progress', 'testing', 'blocked', 'completed', 'skipped', 'cancelled') then
    raise exception 'invalid_action_status';
  end if;
  if restore_status = 'blocked' and btrim(coalesce(restore_blocker, '')) = '' then
    raise exception 'action_blocker_required';
  end if;
  if restore_status <> 'blocked' and restore_review_on is not null then
    raise exception 'review_date_requires_blocker';
  end if;

  -- Serialize this with next-action selection for the same Goal.
  if target_goal_id is not null then
    perform 1 from public.goals where id = target_goal_id for update;
    if not found then raise exception 'goal_not_found'; end if;
  end if;

  select * into item from public.actions where id = target_action_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if item.goal_id is distinct from target_goal_id then raise exception 'action_context_conflict'; end if;
  if private.activity_command_was_applied(item.workspace_id, command_idempotency_key, 'undo_action_completion_checked') then return item; end if;
  if item.version <> expected_version then raise exception 'action_version_conflict'; end if;

  update public.actions set
    status = restore_status,
    blocker = case when restore_status = 'blocked' then btrim(restore_blocker) else null end,
    review_on = case when restore_status = 'blocked' then restore_review_on else null end,
    completed_at = case when restore_status = 'completed' then item.completed_at else null end,
    skipped_at = case when restore_status = 'skipped' then item.skipped_at else null end,
    cancelled_at = case when restore_status = 'cancelled' then item.cancelled_at else null end,
    is_next = restore_is_next
      and restore_status in ('ready', 'in_progress')
      and not exists (
        select 1 from public.actions other
        where other.goal_id = target_goal_id and other.id <> item.id
          and other.is_next and other.status in ('ready', 'in_progress')
      ),
    updated_at = now(),
    version = version + 1
  where id = item.id returning * into item;

  if item.goal_id is not null and restore_status = 'blocked' then
    insert into public.progress_entries (id, workspace_id, goal_id, action_id, kind, content)
    values (command_idempotency_key, item.workspace_id, item.goal_id, item.id, 'blocker',
      'Zablokowano: ' || btrim(restore_blocker))
    on conflict (id) do nothing;
  end if;

  perform private.append_activity_event(
    item.workspace_id, (select auth.uid()), 'user', 'undo_action_completion_checked', array[item.id],
    jsonb_build_object('to', restore_status, 'isNext', item.is_next), command_idempotency_key
  );
  return item;
end;
$$;

revoke all on function public.undo_action_completion_checked(uuid, uuid, integer, text, text, date, boolean, uuid) from public, anon;
grant execute on function public.undo_action_completion_checked(uuid, uuid, integer, text, text, date, boolean, uuid) to authenticated;

-- Use the same Goal lock for manual selection so the undo check and selection cannot race.
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
  perform 1 from public.goals where id = target_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;
  select * into item from public.actions where id = target_action_id and goal_id = target_goal_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if item.status not in ('ready', 'in_progress') then raise exception 'next_action_not_ready'; end if;
  if private.activity_command_was_applied(item.workspace_id, command_idempotency_key, 'set_next_action_checked') then return item; end if;
  update public.actions set is_next = false, updated_at = now() where goal_id = target_goal_id and is_next;
  update public.actions set is_next = true, updated_at = now() where id = target_action_id returning * into item;
  perform private.append_activity_event_once(
    item.workspace_id, (select auth.uid()), 'user', 'set_next_action_checked', array[item.id],
    jsonb_build_object('goalId', target_goal_id), command_idempotency_key
  );
  return item;
end;
$$;
