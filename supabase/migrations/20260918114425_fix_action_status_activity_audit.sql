-- Keep the action-status command behind the hardened audit boundary. The
-- testing-status migration recreated this function after audit writes had
-- been moved to private.append_activity_event(), restoring a direct insert
-- that authenticated callers are intentionally not allowed to perform.
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
  if target_status not in ('ready', 'in_progress', 'testing', 'blocked', 'completed', 'skipped', 'cancelled') then raise exception 'invalid_action_status'; end if;
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
  perform private.append_activity_event(
    item.workspace_id, (select auth.uid()), 'user', 'set_action_status_checked', array[item.id],
    jsonb_build_object('from', previous_status, 'to', target_status), command_idempotency_key
  );
  return item;
end;
$$;
