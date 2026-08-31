-- Active Project reads use the persistent context table (`areas`). Historical
-- Project aggregates remain available through the workspace export/read model.

create or replace function public.search_workspace(search_query text, result_limit integer default 20)
returns jsonb
language sql
stable
security invoker
as $$
with member_workspaces as (select wm.workspace_id from public.workspace_members wm where wm.user_id = (select auth.uid())), results as (
  select entity.id, 'goal'::text as type, entity.title, goal.outcome as detail, '/goals/' || entity.id::text as route from public.goals goal join public.entities entity on entity.id = goal.id where goal.workspace_id in (select workspace_id from member_workspaces) and (goal.title ilike '%' || search_query || '%' or goal.outcome ilike '%' || search_query || '%')
  union all select action.id, 'action', action.title, action.detail, '/actions/' || action.id::text from public.actions action where action.workspace_id in (select workspace_id from member_workspaces) and (action.title ilike '%' || search_query || '%' or action.detail ilike '%' || search_query || '%')
  union all select entity.id, 'knowledge', entity.title, content.detail, '/knowledge/' || entity.id::text from public.entities entity join public.knowledge_items content on content.entity_id = entity.id where entity.workspace_id in (select workspace_id from member_workspaces) and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation') and (entity.title ilike '%' || search_query || '%' or content.detail ilike '%' || search_query || '%')
  union all select area.id, 'project', area.name, area.description, '/projects/' || area.id::text from public.areas area where area.workspace_id in (select workspace_id from member_workspaces) and area.archived_at is null and area.trashed_at is null and (area.name ilike '%' || search_query || '%' or area.description ilike '%' || search_query || '%')
  union all select item.id, 'inbox', item.raw_content, null, '/knowledge?section=inbox&item=' || item.id::text from public.inbox_items item where item.workspace_id in (select workspace_id from member_workspaces) and item.raw_content ilike '%' || search_query || '%'
), limited as (
  select * from results where length(btrim(search_query)) >= 2 order by title, id limit greatest(1, least(coalesce(result_limit, 20), 20))
)
select coalesce(jsonb_agg(jsonb_build_object('id', limited.id, 'type', limited.type, 'title', limited.title, 'detail', limited.detail, 'route', limited.route) order by limited.title, limited.id), '[]'::jsonb) from limited;
$$;

create or replace function public.get_ai_inbox_triage_context(target_workspace_id uuid, target_inbox_item_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
select case when private.is_workspace_member(target_workspace_id) then jsonb_build_object(
  'workspaceId', target_workspace_id,
  'sourceSnapshotAt', now(),
  'inbox', jsonb_build_object('id', item.id, 'kind', item.kind, 'content', item.raw_content, 'createdAt', item.created_at, 'status', item.status),
  'goals', coalesce((select jsonb_agg(jsonb_build_object(
    'id', goal.id, 'title', goal.title, 'outcome', goal.outcome, 'priority', goal.priority,
    'targetDate', goal.target_date, 'areaId', goal.area_id
  ) order by case goal.priority when 'high' then 0 when 'normal' then 1 else 2 end, goal.target_date nulls last, goal.updated_at desc, goal.id)
    from (select goal.* from public.goals goal where goal.workspace_id = target_workspace_id and goal.status = 'active' and goal.archived_at is null and goal.trashed_at is null order by case goal.priority when 'high' then 0 when 'normal' then 1 else 2 end, goal.target_date nulls last, goal.updated_at desc, goal.id limit 50) goal), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(jsonb_build_object(
    'id', area.id, 'title', area.name, 'outcome', area.description, 'status', 'active'
  ) order by area.updated_at desc, area.id)
    from public.areas area
    where area.workspace_id = target_workspace_id and area.archived_at is null and area.trashed_at is null limit 50), '[]'::jsonb)
) else null end
from public.inbox_items item
where item.id = target_inbox_item_id and item.workspace_id = target_workspace_id;
$$;
