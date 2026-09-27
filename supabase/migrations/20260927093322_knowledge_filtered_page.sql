drop function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text);

create function public.get_knowledge_page(
  target_workspace_id uuid,
  page_size integer default 50,
  cursor_sort_value text default null,
  cursor_id uuid default null,
  target_resource_format text default null,
  target_reading_status text default null,
  target_knowledge_kind text default null,
  target_search_text text default null,
  target_project_id uuid default null,
  target_goal_id uuid default null,
  target_visibility text default 'active'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with filtered as materialized (
  select entity.id, entity.version, entity.type, entity.title, entity.archived_at, entity.trashed_at,
    content.detail, content.source_url, content.source_inbox_item_id, content.resource_format,
    content.resource_author, content.reading_status, content.created_at, content.updated_at
  from public.entities entity
  join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
  where entity.workspace_id = target_workspace_id
    and private.is_workspace_member(entity.workspace_id)
    and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
    and (target_visibility is null or target_visibility = 'all'
      or (target_visibility = 'active' and entity.archived_at is null and entity.trashed_at is null)
      or (target_visibility = 'archived' and entity.archived_at is not null and entity.trashed_at is null)
      or (target_visibility = 'trashed' and entity.trashed_at is not null))
    and (target_resource_format is null or content.resource_format = target_resource_format)
    and (target_reading_status is null or (content.resource_format = 'book' and content.reading_status = target_reading_status))
    and (target_knowledge_kind is null or entity.type::text = target_knowledge_kind)
    and (nullif(btrim(target_search_text), '') is null or entity.title ilike '%' || target_search_text || '%'
      or content.detail ilike '%' || target_search_text || '%' or content.resource_author ilike '%' || target_search_text || '%')
    and (target_goal_id is null or exists (
      select 1 from public.knowledge_links link
      left join public.actions action on action.id = link.action_id and action.workspace_id = link.workspace_id
      where link.workspace_id = target_workspace_id and link.knowledge_entity_id = entity.id
        and (link.goal_id = target_goal_id or action.goal_id = target_goal_id)
    ))
    and (target_project_id is null or exists (
      select 1 from public.knowledge_links link
      left join public.goals direct_goal on direct_goal.id = link.goal_id and direct_goal.workspace_id = link.workspace_id
      left join public.actions action on action.id = link.action_id and action.workspace_id = link.workspace_id
      left join public.goals action_goal on action_goal.id = action.goal_id and action_goal.workspace_id = link.workspace_id
      left join public.recurring_action_templates recurring on recurring.id = link.recurring_template_id and recurring.workspace_id = link.workspace_id
      left join public.goals recurring_goal on recurring_goal.id = recurring.goal_id and recurring_goal.workspace_id = link.workspace_id
      where link.workspace_id = target_workspace_id and link.knowledge_entity_id = entity.id
        and (link.area_id = target_project_id or direct_goal.area_id = target_project_id
          or action.area_id = target_project_id or action_goal.area_id = target_project_id
          or recurring.area_id = target_project_id or recurring_goal.area_id = target_project_id)
    ) or exists (
      select 1
      from public.knowledge_links source_link
      join public.knowledge_links context_link on context_link.knowledge_entity_id = source_link.knowledge_entity_id
        and context_link.workspace_id = source_link.workspace_id
      left join public.goals direct_goal on direct_goal.id = context_link.goal_id and direct_goal.workspace_id = context_link.workspace_id
      left join public.actions action on action.id = context_link.action_id and action.workspace_id = context_link.workspace_id
      left join public.goals action_goal on action_goal.id = action.goal_id and action_goal.workspace_id = context_link.workspace_id
      left join public.recurring_action_templates recurring on recurring.id = context_link.recurring_template_id and recurring.workspace_id = context_link.workspace_id
      left join public.goals recurring_goal on recurring_goal.id = recurring.goal_id and recurring_goal.workspace_id = context_link.workspace_id
      where source_link.workspace_id = target_workspace_id and source_link.target_knowledge_entity_id = entity.id
        and source_link.meaning = 'source'
        and (context_link.area_id = target_project_id or direct_goal.area_id = target_project_id
          or action.area_id = target_project_id or action_goal.area_id = target_project_id
          or recurring.area_id = target_project_id or recurring_goal.area_id = target_project_id)
    ))
), ranked as (
  select filtered.*, row_number() over (order by updated_at, id) as row_no
  from filtered
  where cursor_sort_value is null or (updated_at::text, id::text) > (cursor_sort_value, cursor_id::text)
  order by updated_at, id
  limit greatest(1, least(coalesce(page_size, 50), 100)) + 1
), visible as (
  select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 50), 100))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'id', item.id, 'version', item.version, 'type', item.type, 'title', item.title, 'detail', item.detail,
    'sourceUrl', item.source_url, 'sourceInboxItemId', item.source_inbox_item_id,
    'resourceFormat', item.resource_format, 'resourceAuthor', item.resource_author, 'readingStatus', item.reading_status,
    'archivedAt', item.archived_at, 'trashedAt', item.trashed_at, 'createdAt', item.created_at, 'updatedAt', item.updated_at
  ) order by item.updated_at, item.id) from visible item), '[]'::jsonb),
  'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 50), 100)) + 1)
    then (select jsonb_build_object('sortValue', item.updated_at::text, 'id', item.id) from visible item order by item.updated_at desc, item.id desc limit 1)
    else null end,
  'totalCount', (select count(*) from filtered)
);
$$;

revoke all on function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text, uuid, uuid, text) from public, anon;
grant execute on function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text, uuid, uuid, text) to authenticated;
