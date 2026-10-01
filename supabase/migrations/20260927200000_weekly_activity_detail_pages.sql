-- Paginated source records use the same Workspace week, timezone and visibility
-- rules as get_workspace_weekly_summary. Counts are returned independently of
-- the current page so mobile detail lists can reconcile as the user pages.
create function public.get_weekly_activity_page(
  target_workspace_id uuid,
  target_activity_kind text,
  period_start date,
  period_end_exclusive date,
  period_timezone text,
  page_size integer default 25,
  cursor_sort_value text default null,
  cursor_id uuid default null,
  target_project_id uuid default null,
  target_goal_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  workspace_timezone text;
  result jsonb;
begin
  if not private.is_workspace_member(target_workspace_id) then
    raise exception 'workspace_access_denied' using errcode = '42501';
  end if;
  if target_activity_kind not in ('actions', 'knowledge', 'progress') then
    raise exception 'invalid_weekly_activity_kind';
  end if;
  if period_start is null or period_end_exclusive is null or period_end_exclusive <> period_start + 7 then
    raise exception 'invalid_review_period';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = period_timezone) then
    raise exception 'invalid_review_timezone';
  end if;

  select workspace.timezone into workspace_timezone
  from public.workspaces workspace
  where workspace.id = target_workspace_id;
  if workspace_timezone is null then raise exception 'workspace_not_found'; end if;

  with activity as (
    select action.id, 'actions'::text as kind, action.title, action.detail,
      action.completed_at as occurred_at, action.goal_id,
      coalesce(action.area_id, goal.area_id) as project_id
    from public.actions action
    left join public.goals goal on goal.id = action.goal_id and goal.workspace_id = action.workspace_id
    where target_activity_kind = 'actions'
      and action.workspace_id = target_workspace_id
      and action.status = 'completed'
      and action.archived_at is null and action.trashed_at is null
      and action.completed_at >= (period_start::timestamp at time zone period_timezone)
      and action.completed_at < (period_end_exclusive::timestamp at time zone period_timezone)
      and (action.goal_id is null or (goal.archived_at is null and goal.trashed_at is null))
      and (action.area_id is null or not exists (select 1 from public.areas area where area.id = action.area_id and (area.archived_at is not null or area.trashed_at is not null)))
    union all
    select entity.id, 'knowledge'::text, entity.title, item.detail, item.created_at,
      relation.goal_id, coalesce(relation.area_id, goal.area_id)
    from public.knowledge_items item
    join public.entities entity on entity.id = item.entity_id and entity.workspace_id = item.workspace_id
    left join lateral (
      select link.goal_id, link.area_id from public.knowledge_links link
      where link.workspace_id = item.workspace_id and link.knowledge_entity_id = item.entity_id
      order by link.created_at, link.id limit 1
    ) relation on true
    left join public.goals goal on goal.id = relation.goal_id and goal.workspace_id = item.workspace_id
    where target_activity_kind = 'knowledge'
      and item.workspace_id = target_workspace_id
      and item.created_at >= (period_start::timestamp at time zone period_timezone)
      and item.created_at < (period_end_exclusive::timestamp at time zone period_timezone)
      and entity.archived_at is null and entity.trashed_at is null
    union all
    select entry.id, 'progress'::text, goal.title, entry.content, entry.created_at,
      entry.goal_id, goal.area_id
    from public.progress_entries entry
    join public.goals goal on goal.id = entry.goal_id and goal.workspace_id = entry.workspace_id
    where target_activity_kind = 'progress'
      and entry.workspace_id = target_workspace_id
      and entry.created_at >= (period_start::timestamp at time zone period_timezone)
      and entry.created_at < (period_end_exclusive::timestamp at time zone period_timezone)
      and goal.archived_at is null and goal.trashed_at is null
  ), filtered as (
    select * from activity
    where (target_project_id is null or project_id = target_project_id)
      and (target_goal_id is null or goal_id = target_goal_id)
  ), ranked as (
    select filtered.*, row_number() over (order by occurred_at, id) as row_no
    from filtered
    where cursor_sort_value is null or (occurred_at, id) > (cursor_sort_value::timestamptz, cursor_id)
    order by occurred_at, id
    limit greatest(1, least(coalesce(page_size, 25), 100)) + 1
  ), visible as (
    select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 25), 100))
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', item.id, 'kind', item.kind, 'title', item.title, 'detail', item.detail,
      'occurredAt', item.occurred_at, 'goalId', item.goal_id, 'projectId', item.project_id
    ) order by item.occurred_at, item.id) from visible item), '[]'::jsonb),
    'totalCount', (select count(*) from filtered),
    'nextCursor', case when exists (
      select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 25), 100)) + 1
    ) then (select jsonb_build_object('sortValue', item.occurred_at::text, 'id', item.id)
      from visible item order by item.occurred_at desc, item.id desc limit 1)
    else null end
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_weekly_activity_page(uuid, text, date, date, text, integer, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_weekly_activity_page(uuid, text, date, date, text, integer, text, uuid, uuid, uuid) to authenticated;
