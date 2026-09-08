-- Drafts keep a server baseline. These commands make an intentional choice
-- mandatory before a stale local draft can change a Goal or Knowledge item.
create or replace function public.update_goal_details_checked(
  target_goal_id uuid, expected_version integer, goal_changes jsonb, command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.goals;
begin
  select * into item from public.goals where id = target_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  if item.version <> expected_version then raise exception 'goal_version_conflict'; end if;
  return public.update_goal_details(target_goal_id, goal_changes, command_idempotency_key);
end;
$$;

create or replace function public.update_knowledge_item_checked(
  target_knowledge_id uuid, expected_version integer, knowledge_changes jsonb, goal_links jsonb, command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.entities;
begin
  select * into item from public.entities where id = target_knowledge_id for update;
  if not found or item.type not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'knowledge_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item.id; end if;
  if item.version <> expected_version then raise exception 'knowledge_version_conflict'; end if;
  return public.update_knowledge_item(target_knowledge_id, knowledge_changes, goal_links, command_idempotency_key);
end;
$$;

revoke all on function public.update_goal_details_checked(uuid, integer, jsonb, uuid) from public, anon;
grant execute on function public.update_goal_details_checked(uuid, integer, jsonb, uuid) to authenticated;
revoke all on function public.update_knowledge_item_checked(uuid, integer, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.update_knowledge_item_checked(uuid, integer, jsonb, jsonb, uuid) to authenticated;

create or replace function public.add_progress_checked(
  target_workspace_id uuid, target_progress_id uuid, target_goal_id uuid,
  progress_kind text, progress_content text, target_action_id uuid,
  target_knowledge_id uuid, command_idempotency_key uuid
)
returns public.progress_entries
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.progress_entries;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  insert into public.progress_entries (id, workspace_id, goal_id, action_id, knowledge_entity_id, kind, content)
  values (target_progress_id, target_workspace_id, target_goal_id, target_action_id, target_knowledge_id, progress_kind, btrim(progress_content))
  on conflict (id) do nothing;
  select * into item from public.progress_entries where id = target_progress_id;
  return item;
end;
$$;

revoke all on function public.add_progress_checked(uuid, uuid, uuid, text, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.add_progress_checked(uuid, uuid, uuid, text, text, uuid, uuid, uuid) to authenticated;
