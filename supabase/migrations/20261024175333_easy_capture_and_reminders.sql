-- Fast capture, reliable retrieval and opt-in reminders. No existing records are removed.
create function public.undo_capture(target_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare target_workspace uuid;
begin
  update public.inbox_items set status='discarded', discarded_at=now()
  where id=target_id and status='unprocessed' and private.is_workspace_member(workspace_id)
  returning workspace_id into target_workspace;
  if not found then raise exception 'capture_changed_or_unavailable'; end if;
  perform private.append_activity_event(target_workspace,(select auth.uid()),'user','undo_capture','{}',jsonb_build_object('inboxItemId',target_id),gen_random_uuid());
end;
$$;
revoke all on function public.undo_capture(uuid) from public, anon;
grant execute on function public.undo_capture(uuid) to authenticated;

create function public.get_inbox_filtered_page(target_workspace_id uuid, target_status text default null, page_size integer default 50, cursor_sort_value text default null, cursor_id uuid default null, target_item_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
with candidates as (
  select * from public.inbox_items where workspace_id=target_workspace_id
    and private.is_workspace_member(workspace_id)
    and (target_status is null or status::text=target_status)
    and (target_item_id is null or id=target_item_id)
), ranked as (
  select *, row_number() over (order by created_at desc,id desc) row_no from candidates
  where cursor_sort_value is null or (created_at,id) < (cursor_sort_value::timestamptz,cursor_id)
  order by created_at desc,id desc limit greatest(1,least(coalesce(page_size,50),100))+1
), visible as (select * from ranked where row_no<=greatest(1,least(coalesce(page_size,50),100)))
select jsonb_build_object('totalCount',(select count(*) from candidates),'items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',id,'kind',kind,'content',raw_content,'createdAt',created_at,'status',status,'snoozedUntil',snoozed_until,'discardedAt',discarded_at,'resolvedToIds',resolved_to_ids
) order by row_no) from visible),'[]'::jsonb),'nextCursor',case when exists(select 1 from ranked where row_no>greatest(1,least(coalesce(page_size,50),100))) then
(select jsonb_build_object('sortValue',created_at::text,'id',id) from visible order by row_no desc limit 1) else null end);
$$;
revoke all on function public.get_inbox_filtered_page(uuid,text,integer,text,uuid,uuid) from public,anon;
grant execute on function public.get_inbox_filtered_page(uuid,text,integer,text,uuid,uuid) to authenticated;
create index if not exists inbox_status_created_idx on public.inbox_items(workspace_id,status,created_at desc,id desc);

create or replace function public.get_actions_filtered_page(
  target_workspace_id uuid,
  target_view text default 'open',
  target_schedule text default null,
  target_project_id uuid default null,
  target_goal_id uuid default null,
  target_today date default null,
  page_size integer default 30,
  cursor_sort_value text default null,
  cursor_id uuid default null
)
returns jsonb
language sql
stable
security invoker set search_path = ''
as $$
with workspace_context as (
  select w.id, coalesce(target_today, (now() at time zone w.timezone)::date) as today
  from public.workspaces w
  where w.id = target_workspace_id
    and private.is_workspace_member(w.id)
), candidates as (
  select
    action.*,
    goal.area_id as goal_area_id,
    case when target_view in ('completed', 'cancelled', 'skipped')
      then coalesce(action.completed_at, action.cancelled_at, action.skipped_at, action.updated_at, '0001-01-01 00:00:00+00'::timestamptz)::text
      when target_view = 'waiting' then action.review_on::text
      else coalesce(action.scheduled_for::text, '9999-12-31')
    end as sort_value
  from public.actions action
  join workspace_context workspace on workspace.id = action.workspace_id
  left join public.goals goal on goal.id = action.goal_id and goal.workspace_id = action.workspace_id
  left join public.areas action_project on action_project.id = action.area_id and action_project.workspace_id = action.workspace_id
  left join public.areas goal_project on goal_project.id = goal.area_id and goal_project.workspace_id = action.workspace_id
  where action.workspace_id = target_workspace_id
    and action.archived_at is null
    and action.trashed_at is null
    and (action.goal_id is null or (goal.id is not null and goal.archived_at is null and goal.trashed_at is null))
    and (action.area_id is null or (action_project.id is not null and action_project.archived_at is null and action_project.trashed_at is null))
    and (goal.area_id is null or (goal_project.id is not null and goal_project.archived_at is null and goal_project.trashed_at is null))
    and (target_goal_id is null or action.goal_id = target_goal_id)
    and (target_project_id is null or action.area_id = target_project_id or goal.area_id = target_project_id)
    and case target_schedule
      when 'today' then action.scheduled_for = workspace.today or action.pinned_to_today
      when 'overdue' then action.scheduled_for < workspace.today
      when 'unscheduled' then action.scheduled_for is null and not action.pinned_to_today
      else target_schedule is null
    end
    and case target_view
      when 'completed' then action.status = 'completed'
      when 'cancelled' then action.status = 'cancelled'
      when 'skipped' then action.status = 'skipped'
      when 'ready' then action.status = 'ready'
      when 'in_progress' then action.status = 'in_progress'
      when 'testing' then action.status = 'testing'
      when 'blocked' then action.status = 'blocked'
      when 'waiting' then action.status = 'blocked' and action.review_on <= workspace.today
      when 'today' then action.status in ('ready', 'in_progress', 'testing', 'blocked')
        and (action.scheduled_for = workspace.today or action.pinned_to_today)
      when 'overdue' then action.status in ('ready', 'in_progress', 'testing', 'blocked')
        and action.scheduled_for < workspace.today
      when 'unscheduled' then action.status in ('ready', 'in_progress', 'testing', 'blocked')
        and action.scheduled_for is null
        and not action.pinned_to_today
      else action.status in ('ready', 'in_progress', 'testing', 'blocked')
    end
), ranked as (
  select candidates.*, row_number() over (
    order by
      case when target_view in ('completed', 'cancelled', 'skipped') then sort_value end desc nulls last,
      case when target_view not in ('completed', 'cancelled', 'skipped') then sort_value end asc nulls last,
      case when target_view in ('completed', 'cancelled', 'skipped') then id end desc,
      case when target_view not in ('completed', 'cancelled', 'skipped') then id end asc
  ) as row_no
  from candidates
  where cursor_sort_value is null
    or (target_view in ('completed', 'cancelled', 'skipped') and (sort_value, id::text) < (cursor_sort_value, cursor_id::text))
    or (target_view not in ('completed', 'cancelled', 'skipped') and (sort_value, id::text) > (cursor_sort_value, cursor_id::text))
  order by
    case when target_view in ('completed', 'cancelled', 'skipped') then sort_value end desc nulls last,
    case when target_view not in ('completed', 'cancelled', 'skipped') then sort_value end asc nulls last,
    case when target_view in ('completed', 'cancelled', 'skipped') then id end desc,
    case when target_view not in ('completed', 'cancelled', 'skipped') then id end asc
  limit greatest(1, least(coalesce(page_size, 30), 100)) + 1
), visible as (
  select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 30), 100))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'id', item.id, 'version', item.version, 'goalId', item.goal_id, 'areaId', item.area_id,
    'title', item.title, 'detail', item.detail, 'status', item.status, 'blocker', item.blocker,
    'reviewOn',item.review_on,'position', item.position, 'isNext', item.is_next, 'pinnedToToday', item.pinned_to_today,
    'scheduledFor', item.scheduled_for, 'completedAt', item.completed_at, 'skippedAt', item.skipped_at,
    'cancelledAt', item.cancelled_at, 'recurringTemplateId', item.recurring_template_id,
    'occurrenceDate', item.occurrence_date, 'checklist', item.checklist,
    'legacySourceId', item.legacy_source_id, 'createdAt', item.created_at, 'updatedAt', item.updated_at
  ) order by item.row_no) from visible item), '[]'::jsonb),
  'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 30), 100)) + 1)
    then (select jsonb_build_object('sortValue', item.sort_value, 'id', item.id)
      from visible item order by item.row_no desc limit 1)
    else null end
);
$$;

revoke all on function public.get_actions_filtered_page(uuid,text,text,uuid,uuid,date,integer,text,uuid) from public,anon;
grant execute on function public.get_actions_filtered_page(uuid,text,text,uuid,uuid,date,integer,text,uuid) to authenticated;
create or replace function private.validate_saved_action_view() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from (select auth.uid()) then raise exception 'saved_view_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text || new.workspace_id::text, 0));
  if tg_op = 'INSERT' and (select count(*) from public.saved_action_views where user_id = new.user_id and workspace_id = new.workspace_id) >= 5 then raise exception 'saved_view_limit'; end if;
  if tg_op = 'UPDATE' and (new.workspace_id <> old.workspace_id or new.user_id <> old.user_id or new.version <> old.version + 1) then raise exception 'saved_view_version_conflict'; end if;
  if tg_op = 'INSERT' and new.version <> 1 then raise exception 'saved_view_version_conflict'; end if;
  if jsonb_typeof(new.filters) <> 'object' or new.filters ->> 'view' is null or new.filters ->> 'view' not in ('open','ready','in_progress','testing','waiting','blocked','completed','cancelled','skipped','today','overdue','unscheduled')
    or exists (select 1 from jsonb_object_keys(new.filters) key where key not in ('view','schedule','projectId','goalId')) then raise exception 'invalid_saved_view_filters'; end if;
  if new.filters ? 'schedule' and (jsonb_typeof(new.filters -> 'schedule') <> 'string' or new.filters ->> 'schedule' not in ('today','overdue','unscheduled')) then raise exception 'invalid_saved_view_schedule'; end if;
  if new.filters ? 'projectId' and (jsonb_typeof(new.filters -> 'projectId') <> 'string' or not exists (select 1 from public.areas where id = (new.filters ->> 'projectId')::uuid and workspace_id = new.workspace_id)) then raise exception 'saved_view_project_unavailable'; end if;
  if new.filters ? 'goalId' and (jsonb_typeof(new.filters -> 'goalId') <> 'string' or not exists (select 1 from public.goals where id = (new.filters ->> 'goalId')::uuid and workspace_id = new.workspace_id)) then raise exception 'saved_view_goal_unavailable'; end if;
  new.updated_at := now();
  return new;
end;
$$;

create table public.return_reminders (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id uuid not null,
  enabled boolean not null default false,
  weekdays integer[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]),
  local_time time not null,
  timezone text not null,
  destination text not null check (destination in ('/','/capture')),
  subscription jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
alter table public.return_reminders enable row level security;
revoke all on public.return_reminders from public,anon;
grant select,insert,update,delete on public.return_reminders to authenticated,service_role;
create policy return_reminders_owner on public.return_reminders for all to authenticated
  using (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id))
  with check (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id));
create index return_reminders_user_idx on public.return_reminders(user_id);

create function private.validate_return_reminder() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'invalid_reminder_timezone'; end if;
  if extract(second from new.local_time) <> 0 then raise exception 'invalid_reminder_time'; end if;
  if jsonb_typeof(new.subscription) <> 'object' or coalesce(length(new.subscription->>'endpoint'),0) not between 1 and 4096
    or new.subscription->>'endpoint' !~ '^https://'
    or coalesce(length(new.subscription#>>'{keys,p256dh}'),0) not between 1 and 256
    or coalesce(length(new.subscription#>>'{keys,auth}'),0) not between 1 and 256 then raise exception 'invalid_push_subscription'; end if;
  new.updated_at=clock_timestamp();
  return new;
end;
$$;
revoke all on function private.validate_return_reminder() from public,anon;
grant execute on function private.validate_return_reminder() to authenticated,service_role;
create trigger validate_return_reminder before insert or update on public.return_reminders for each row execute function private.validate_return_reminder();

create table public.return_reminder_deliveries (
  workspace_id uuid not null,
  user_id uuid not null,
  local_date date not null,
  attempts integer not null default 1,
  lease_until timestamptz not null,
  status text not null default 'sending' check(status in ('sending','sent','failed','expired')),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id,local_date),
  foreign key(workspace_id,user_id) references public.return_reminders(workspace_id,user_id) on delete cascade
);
alter table public.return_reminder_deliveries enable row level security;
revoke all on public.return_reminder_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.return_reminder_deliveries to service_role;
create policy reminder_delivery_service on public.return_reminder_deliveries for all to service_role using (true) with check (true);
grant select on public.workspace_members to service_role;

-- Invoked only by the authenticated scheduler. Claim leases prevent concurrent sends.
create function public.claim_return_reminders() returns setof jsonb language plpgsql security invoker set search_path='' as $$
declare r record; claimed integer;
begin
  delete from public.return_reminder_deliveries where local_date < current_date-30;
  for r in select cfg.*, now() at time zone cfg.timezone as local_now from public.return_reminders cfg
    where cfg.enabled and exists(select 1 from public.workspace_members m where m.workspace_id=cfg.workspace_id and m.user_id=cfg.user_id)
    and extract(dow from now() at time zone cfg.timezone)::integer=any(cfg.weekdays)
    and (now() at time zone cfg.timezone)::time >= cfg.local_time
    and (now() at time zone cfg.timezone) < (now() at time zone cfg.timezone)::date+cfg.local_time+interval '10 minutes'
    and not exists (select 1 from public.return_reminder_deliveries d
      where d.workspace_id=cfg.workspace_id and d.user_id=cfg.user_id and d.local_date=(now() at time zone cfg.timezone)::date
      and (d.status in ('sent','expired') or d.attempts>=3 or d.lease_until>=now()))
    order by cfg.workspace_id,cfg.user_id limit 100
  loop
    insert into public.return_reminder_deliveries(workspace_id,user_id,local_date,lease_until)
      values(r.workspace_id,r.user_id,r.local_now::date,now()+interval '3 minutes')
    on conflict(workspace_id,user_id,local_date) do update set attempts=public.return_reminder_deliveries.attempts+1,lease_until=now()+interval '3 minutes',status='sending',updated_at=now()
      where public.return_reminder_deliveries.status in ('sending','failed') and public.return_reminder_deliveries.lease_until<now() and public.return_reminder_deliveries.attempts<3;
    get diagnostics claimed=row_count;
    if claimed>0 then return next to_jsonb(r) || jsonb_build_object('local_date',r.local_now::date); end if;
  end loop;
end;
$$;
revoke all on function public.claim_return_reminders() from public,anon,authenticated;
grant execute on function public.claim_return_reminders() to service_role;

create function public.detach_reminder_device(target_device_id uuid) returns void language sql security invoker set search_path='' as $$
  update public.return_reminders set enabled=false where user_id=(select auth.uid()) and device_id=target_device_id;
$$;
revoke all on function public.detach_reminder_device(uuid) from public,anon;
grant execute on function public.detach_reminder_device(uuid) to authenticated;

create or replace function public.get_actions_page(target_workspace_id uuid, target_view text default 'open', target_project_id uuid default null, target_goal_id uuid default null, target_today date default null, page_size integer default 30, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
select public.get_actions_filtered_page(target_workspace_id,target_view,null,target_project_id,target_goal_id,target_today,page_size,cursor_sort_value,cursor_id);
$$;
revoke all on function public.get_actions_page(uuid,text,uuid,uuid,date,integer,text,uuid) from public,anon;
grant execute on function public.get_actions_page(uuid,text,uuid,uuid,date,integer,text,uuid) to authenticated;

create or replace function public.capture_item(
  target_workspace_id uuid,
  capture_content text,
  capture_kind public.capture_kind,
  command_idempotency_key uuid
)
returns public.inbox_items
language plpgsql
security invoker
set search_path = ''
as $$
declare captured public.inbox_items;
begin
  if btrim(capture_content) = '' then raise exception 'capture_content_required'; end if;
  insert into public.inbox_items (workspace_id, kind, raw_content, idempotency_key, created_by)
  values (target_workspace_id, capture_kind, capture_content, command_idempotency_key, (select auth.uid()))
  on conflict (workspace_id, idempotency_key) do update set raw_content = public.inbox_items.raw_content
  returning * into captured;
  if captured.raw_content is distinct from capture_content or captured.kind is distinct from capture_kind then
    raise exception 'capture_payload_conflict';
  end if;

  perform private.append_activity_event_once(target_workspace_id, (select auth.uid()), 'user', 'capture_item', '{}', jsonb_build_object('inboxItemId', captured.id, 'kind', captured.kind), command_idempotency_key);
  return captured;
end;
$$;
revoke all on function public.capture_item(uuid,text,public.capture_kind,uuid) from public,anon;
grant execute on function public.capture_item(uuid,text,public.capture_kind,uuid) to authenticated;
