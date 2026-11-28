create or replace function public.get_knowledge_page(
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
  target_visibility text default 'active',
  target_revisit_on date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with relevant_projects as (
  select project.id, strpos(lower(project.name), lower(nullif(btrim(target_search_text), ''))) > 0 as matches_search
  from public.areas project
  where project.workspace_id = target_workspace_id
    and (project.id = target_project_id
      or strpos(lower(project.name), lower(nullif(btrim(target_search_text), ''))) > 0)
), linked_projects as materialized (
  select link.knowledge_entity_id, project.id as project_id, project.matches_search
  from public.knowledge_links link
  left join public.goals direct_goal on direct_goal.id = link.goal_id and direct_goal.workspace_id = link.workspace_id
  left join public.actions action on action.id = link.action_id and action.workspace_id = link.workspace_id
  left join public.goals action_goal on action_goal.id = action.goal_id and action_goal.workspace_id = link.workspace_id
  left join public.recurring_action_templates recurring on recurring.id = link.recurring_template_id and recurring.workspace_id = link.workspace_id
  left join public.goals recurring_goal on recurring_goal.id = recurring.goal_id and recurring_goal.workspace_id = link.workspace_id
  join relevant_projects project on project.id in (
    link.area_id, direct_goal.area_id, action.area_id, action_goal.area_id, recurring.area_id, recurring_goal.area_id
  )
  where link.workspace_id = target_workspace_id
), project_context as (
  select knowledge_entity_id, project_id, matches_search
  from linked_projects
  union
  select source.target_knowledge_entity_id, project.project_id, project.matches_search
  from public.knowledge_links source
  join linked_projects project on project.knowledge_entity_id = source.knowledge_entity_id
  where source.workspace_id = target_workspace_id and source.meaning = 'source'
    and source.target_knowledge_entity_id is not null
), filtered as materialized (
  select entity.id, entity.version, entity.type, entity.title, entity.archived_at, entity.trashed_at,
    content.detail, content.source_url, content.source_inbox_item_id, content.resource_format,
    content.resource_author, content.reading_status, content.revisit_on, content.created_at, content.updated_at
  from public.entities entity
  join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
  where entity.workspace_id = target_workspace_id
    and private.is_workspace_member(entity.workspace_id)
    and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
    and (target_visibility is null or target_visibility = 'all'
      or (target_visibility = 'active' and entity.archived_at is null and entity.trashed_at is null)
      or (target_visibility = 'archived' and entity.archived_at is not null and entity.trashed_at is null)
      or (target_visibility = 'trashed' and entity.trashed_at is not null))
    and (target_revisit_on is null or (entity.type in ('resource','note') and entity.archived_at is null and entity.trashed_at is null and content.revisit_on <= target_revisit_on))
    and (target_resource_format is null or content.resource_format = target_resource_format)
    and (target_reading_status is null or (content.resource_format = 'book' and content.reading_status = target_reading_status))
    and (target_knowledge_kind is null or entity.type::text = target_knowledge_kind)
    and (nullif(btrim(target_search_text), '') is null or entity.title ilike '%' || target_search_text || '%'
      or content.detail ilike '%' || target_search_text || '%' or content.resource_author ilike '%' || target_search_text || '%'
      or exists (
        select 1 from project_context context
        where context.knowledge_entity_id = entity.id and context.matches_search
      ))
    and (target_goal_id is null or exists (
      select 1 from public.knowledge_links link
      left join public.actions action on action.id = link.action_id and action.workspace_id = link.workspace_id
      where link.workspace_id = target_workspace_id and link.knowledge_entity_id = entity.id
        and (link.goal_id = target_goal_id or action.goal_id = target_goal_id)
    ))
    and (target_project_id is null or exists (
      select 1 from project_context context
      where context.knowledge_entity_id = entity.id and context.project_id = target_project_id
    ))
), duplicate_result_titles as (
  select lower(btrim(title)) as title_key
  from filtered
  where type = 'artifact'
  group by lower(btrim(title))
  having count(*) > 1
), ranked as (
  select filtered.*, row_number() over (order by case when target_revisit_on is null then updated_at::text else revisit_on::text end, id) as row_no
  from filtered
  where cursor_sort_value is null or (case when target_revisit_on is null then updated_at::text else revisit_on::text end, id::text) > (cursor_sort_value, cursor_id::text)
  order by case when target_revisit_on is null then updated_at::text else revisit_on::text end, id
  limit greatest(1, least(coalesce(page_size, 50), 100)) + 1
), visible as (
  select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 50), 100))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(public.get_knowledge_item(item.id) order by case when target_revisit_on is null then item.updated_at::text else item.revisit_on::text end, item.id) from visible item), '[]'::jsonb),
  'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 50), 100)) + 1)
    then (select jsonb_build_object('sortValue', case when target_revisit_on is null then item.updated_at::text else item.revisit_on::text end, 'id', item.id) from visible item order by case when target_revisit_on is null then item.updated_at::text else item.revisit_on::text end desc, item.id desc limit 1)
    else null end,
  'duplicateResultIds', coalesce((
    select jsonb_agg(item.id order by item.row_no)
    from visible item
    join duplicate_result_titles duplicate on duplicate.title_key = lower(btrim(item.title))
    where item.type = 'artifact'
  ), '[]'::jsonb),
  'totalCount', (select count(*) from filtered)
);
$$;
