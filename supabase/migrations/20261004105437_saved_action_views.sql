create table public.saved_action_views (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  filter_version integer not null default 1 check (filter_version = 1),
  filters jsonb not null,
  position integer not null default 0 check (position between 0 and 4),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saved_action_views enable row level security;
revoke all on public.saved_action_views from anon;
grant select, insert, update, delete on public.saved_action_views to authenticated;
create policy saved_action_views_owner on public.saved_action_views for all to authenticated
  using (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));
create index saved_action_views_owner_idx on public.saved_action_views(workspace_id,user_id,position,id);
create index saved_action_views_user_idx on public.saved_action_views(user_id);

create function private.validate_saved_action_view() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from (select auth.uid()) then raise exception 'saved_view_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text || new.workspace_id::text, 0));
  if tg_op = 'INSERT' and (select count(*) from public.saved_action_views where user_id = new.user_id and workspace_id = new.workspace_id) >= 5 then raise exception 'saved_view_limit'; end if;
  if tg_op = 'UPDATE' and (new.workspace_id <> old.workspace_id or new.user_id <> old.user_id or new.version <> old.version + 1) then raise exception 'saved_view_version_conflict'; end if;
  if tg_op = 'INSERT' and new.version <> 1 then raise exception 'saved_view_version_conflict'; end if;
  if jsonb_typeof(new.filters) <> 'object' or new.filters ->> 'view' is null or new.filters ->> 'view' not in ('open','ready','in_progress','testing','waiting','blocked','completed','cancelled','skipped','today','overdue','unscheduled')
    or exists (select 1 from jsonb_object_keys(new.filters) key where key not in ('view','projectId','goalId')) then raise exception 'invalid_saved_view_filters'; end if;
  if new.filters ? 'projectId' and (jsonb_typeof(new.filters -> 'projectId') <> 'string' or not exists (select 1 from public.areas where id = (new.filters ->> 'projectId')::uuid and workspace_id = new.workspace_id)) then raise exception 'saved_view_project_unavailable'; end if;
  if new.filters ? 'goalId' and (jsonb_typeof(new.filters -> 'goalId') <> 'string' or not exists (select 1 from public.goals where id = (new.filters ->> 'goalId')::uuid and workspace_id = new.workspace_id)) then raise exception 'saved_view_goal_unavailable'; end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.validate_saved_action_view() from public, anon;
grant execute on function private.validate_saved_action_view() to authenticated;
create trigger saved_action_views_guard before insert or update on public.saved_action_views for each row execute function private.validate_saved_action_view();

create function public.save_action_view(target_workspace_id uuid, target_id uuid, target_name text, target_filters jsonb, target_position integer, expected_version integer)
returns void language plpgsql security invoker set search_path = '' as $$
declare item public.saved_action_views;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((select auth.uid())::text || target_workspace_id::text, 0));
  select * into item from public.saved_action_views where id = target_id and workspace_id = target_workspace_id and user_id = (select auth.uid()) for update;
  if coalesce(item.version,0) is distinct from expected_version then raise exception 'saved_view_version_conflict'; end if;
  if item.id is null then
    insert into public.saved_action_views(id,workspace_id,name,filters,position) values (target_id,target_workspace_id,btrim(target_name),target_filters,target_position);
  else
    update public.saved_action_views set name=btrim(target_name), filters=target_filters, position=target_position, version=version+1 where id=item.id;
  end if;
end;
$$;
create function public.delete_action_view(target_id uuid, expected_version integer) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.saved_action_views where id=target_id and user_id=(select auth.uid()) and version=expected_version;
  if not found then raise exception 'saved_view_version_conflict'; end if;
end;
$$;
revoke all on function public.save_action_view(uuid,uuid,text,jsonb,integer,integer) from public, anon;
revoke all on function public.delete_action_view(uuid,integer) from public, anon;
grant execute on function public.save_action_view(uuid,uuid,text,jsonb,integer,integer) to authenticated;
grant execute on function public.delete_action_view(uuid,integer) to authenticated;
