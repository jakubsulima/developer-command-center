-- Add a distinct verification stage between active work and completion.
alter table public.actions drop constraint if exists actions_status_check;
alter table public.actions add constraint actions_status_check
  check (status in ('ready', 'in_progress', 'testing', 'blocked', 'completed', 'skipped', 'cancelled'));

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
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'set_action_status_checked', array[item.id],
    jsonb_build_object('from', previous_status, 'to', target_status), command_idempotency_key);
  return item;
end;
$$;

create or replace function public.get_actions_page(
  target_workspace_id uuid,
  target_view text default 'open',
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
security invoker
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
    case when target_view = 'completed'
      then coalesce(action.completed_at, action.updated_at, '0001-01-01 00:00:00+00'::timestamptz)::text
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
    and case target_view
      when 'completed' then action.status = 'completed'
      when 'today' then action.status in ('ready', 'in_progress', 'testing', 'blocked')
        and (action.scheduled_for = workspace.today or (action.scheduled_for is null and action.pinned_to_today))
      when 'overdue' then action.status in ('ready', 'in_progress', 'testing', 'blocked')
        and action.scheduled_for < workspace.today
      when 'unscheduled' then action.status in ('ready', 'in_progress', 'testing', 'blocked')
        and action.scheduled_for is null
      when 'blocked' then action.status = 'blocked'
      else action.status in ('ready', 'in_progress', 'testing', 'blocked')
    end
), ranked as (
  select candidates.*, row_number() over (
    order by
      case when target_view = 'completed' then sort_value end desc nulls last,
      case when target_view <> 'completed' then sort_value end asc nulls last,
      case when target_view = 'completed' then id end desc,
      case when target_view <> 'completed' then id end asc
  ) as row_no
  from candidates
  where cursor_sort_value is null
    or (target_view = 'completed' and (sort_value, id::text) < (cursor_sort_value, cursor_id::text))
    or (target_view <> 'completed' and (sort_value, id::text) > (cursor_sort_value, cursor_id::text))
  order by
    case when target_view = 'completed' then sort_value end desc nulls last,
    case when target_view <> 'completed' then sort_value end asc nulls last,
    case when target_view = 'completed' then id end desc,
    case when target_view <> 'completed' then id end asc
  limit greatest(1, least(coalesce(page_size, 30), 100)) + 1
), visible as (
  select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 30), 100))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'id', item.id, 'version', item.version, 'goalId', item.goal_id, 'areaId', item.area_id,
    'title', item.title, 'detail', item.detail, 'status', item.status, 'blocker', item.blocker,
    'position', item.position, 'isNext', item.is_next, 'pinnedToToday', item.pinned_to_today,
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
