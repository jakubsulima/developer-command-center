-- Add a version-aware status command for safe per-action undo. The original
-- four-argument function remains available for older clients.
create or replace function public.set_action_status_checked(
  target_action_id uuid, expected_version integer, target_status text, target_blocker text, command_idempotency_key uuid
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
  return public.set_action_status_checked(target_action_id, target_status, target_blocker, command_idempotency_key);
end;
$$;

revoke all on function public.set_action_status_checked(uuid, integer, text, text, uuid) from public, anon;
grant execute on function public.set_action_status_checked(uuid, integer, text, text, uuid) to authenticated;
