-- Complete, server-filtered Działania collection. The functions stay SECURITY
-- INVOKER so the existing Workspace membership/RLS boundary remains effective.
create index if not exists actions_list_open_cursor_idx
  on public.actions (workspace_id, status, scheduled_for, id)
  where archived_at is null and trashed_at is null;

create index if not exists actions_list_completed_cursor_idx
  on public.actions (workspace_id, status, completed_at, id)
  where status = 'completed' and archived_at is null and trashed_at is null;

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
      when 'today' then action.status in ('ready', 'in_progress', 'blocked')
        and (action.scheduled_for = workspace.today or (action.scheduled_for is null and action.pinned_to_today))
      when 'overdue' then action.status in ('ready', 'in_progress', 'blocked')
        and action.scheduled_for < workspace.today
      when 'unscheduled' then action.status in ('ready', 'in_progress', 'blocked')
        and action.scheduled_for is null
      when 'blocked' then action.status = 'blocked'
      else action.status in ('ready', 'in_progress', 'blocked')
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

create or replace function public.get_action_item(target_action_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
select jsonb_build_object(
  'id', action.id, 'version', action.version, 'goalId', action.goal_id, 'areaId', action.area_id,
  'title', action.title, 'detail', action.detail, 'status', action.status, 'blocker', action.blocker,
  'position', action.position, 'isNext', action.is_next, 'pinnedToToday', action.pinned_to_today,
  'scheduledFor', action.scheduled_for, 'completedAt', action.completed_at, 'skippedAt', action.skipped_at,
  'cancelledAt', action.cancelled_at, 'recurringTemplateId', action.recurring_template_id,
  'occurrenceDate', action.occurrence_date, 'checklist', action.checklist,
  'legacySourceId', action.legacy_source_id, 'createdAt', action.created_at, 'updatedAt', action.updated_at
)
from public.actions action
left join public.goals goal on goal.id = action.goal_id and goal.workspace_id = action.workspace_id
left join public.areas action_project on action_project.id = action.area_id and action_project.workspace_id = action.workspace_id
left join public.areas goal_project on goal_project.id = goal.area_id and goal_project.workspace_id = action.workspace_id
where action.id = target_action_id
  and action.archived_at is null
  and action.trashed_at is null
  and private.is_workspace_member(action.workspace_id)
  and (action.goal_id is null or (goal.id is not null and goal.archived_at is null and goal.trashed_at is null))
  and (action.area_id is null or (action_project.id is not null and action_project.archived_at is null and action_project.trashed_at is null))
  and (goal.area_id is null or (goal_project.id is not null and goal_project.archived_at is null and goal_project.trashed_at is null));
$$;

revoke all on function public.get_actions_page(uuid, text, uuid, uuid, date, integer, text, uuid) from public, anon;
grant execute on function public.get_actions_page(uuid, text, uuid, uuid, date, integer, text, uuid) to authenticated;
revoke all on function public.get_action_item(uuid) from public, anon;
grant execute on function public.get_action_item(uuid) to authenticated;
