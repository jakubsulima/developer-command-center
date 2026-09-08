-- Weekly activity aggregate for the active product. The function is additive:
-- older deployments keep serving get_workspace_core until this migration lands.
create or replace function public.get_workspace_weekly_summary(target_workspace_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
with workspace as (
  select
    w.id,
    w.timezone,
    (date_trunc('week', now() at time zone w.timezone)::date::timestamp at time zone w.timezone) as week_start,
    ((date_trunc('week', now() at time zone w.timezone)::date + 7)::timestamp at time zone w.timezone) as week_end
  from public.workspaces w
  where w.id = target_workspace_id
    and private.is_workspace_member(w.id)
)
select jsonb_build_object(
  'periodStart', to_char(workspace.week_start at time zone workspace.timezone, 'YYYY-MM-DD'),
  'periodEnd', to_char(workspace.week_end at time zone workspace.timezone, 'YYYY-MM-DD'),
  'completedActions', (
    select count(*)
    from public.actions action
    where action.workspace_id = workspace.id
      and action.status = 'completed'
      and action.archived_at is null
      and action.trashed_at is null
      and action.completed_at >= workspace.week_start
      and action.completed_at < workspace.week_end
      and (action.goal_id is null or not exists (
        select 1 from public.goals goal
        where goal.id = action.goal_id
          and (goal.archived_at is not null or goal.trashed_at is not null)
      ))
      and (action.area_id is null or not exists (
        select 1 from public.areas area
        where area.id = action.area_id
          and (area.archived_at is not null or area.trashed_at is not null)
      ))
  ),
  'focusMinutes', coalesce((
    select round(sum(extract(epoch from (session.ended_at - session.started_at)) / 60))::integer
    from public.focus_sessions session
    where session.workspace_id = workspace.id
      and session.ended_at >= workspace.week_start
      and session.ended_at < workspace.week_end
  ), 0),
  'knowledgeAdded', (
    select count(*)
    from public.knowledge_items item
    join public.entities entity on entity.id = item.entity_id and entity.workspace_id = item.workspace_id
    where item.workspace_id = workspace.id
      and item.created_at >= workspace.week_start
      and item.created_at < workspace.week_end
      and entity.archived_at is null
      and entity.trashed_at is null
  ),
  'progressUpdates', (
    select count(*)
    from public.progress_entries entry
    join public.goals goal on goal.id = entry.goal_id and goal.workspace_id = entry.workspace_id
    where entry.workspace_id = workspace.id
      and entry.created_at >= workspace.week_start
      and entry.created_at < workspace.week_end
      and goal.archived_at is null
      and goal.trashed_at is null
  )
)
from workspace;
$$;

revoke all on function public.get_workspace_weekly_summary(uuid) from public, anon;
grant execute on function public.get_workspace_weekly_summary(uuid) to authenticated;
